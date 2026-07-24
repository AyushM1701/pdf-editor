import io
import fitz
import tempfile
import os
import datetime
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from fastapi.responses import StreamingResponse
from app.core.auth import get_api_key

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from cryptography import x509
from cryptography.x509.oid import NameOID

from pyhanko.sign import signers
from pyhanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter

router = APIRouter()

@router.post("/decrypt")
async def decrypt_pdf(
    file: UploadFile = File(...),
    password: str = Form(...),
    api_key: str | None = Depends(get_api_key)
):
    try:
        content = await file.read()
        doc = fitz.open(stream=content, filetype="pdf")
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid PDF file")
        
    if not doc.is_encrypted:
        # If it's not encrypted, just return it as is
        return StreamingResponse(io.BytesIO(content), media_type="application/pdf")
        
    if not doc.authenticate(password):
        raise HTTPException(status_code=401, detail="Incorrect password")
        
    # Password is correct. Save decrypted version to a byte stream.
    # fitz.PDF_ENCRYPT_NONE removes encryption
    output_stream = io.BytesIO()
    doc.save(output_stream, encryption=fitz.PDF_ENCRYPT_NONE)
    output_stream.seek(0)
    
    return StreamingResponse(
        output_stream,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="decrypted_{file.filename}"'}
    )


@router.post("/encrypt")
async def encrypt_pdf(
    file: UploadFile = File(...),
    user_password: str = Form(None),
    owner_password: str = Form(None),
    can_print: bool = Form(True),
    can_modify: bool = Form(True),
    can_copy: bool = Form(True),
    api_key: str | None = Depends(get_api_key)
):
    try:
        content = await file.read()
        doc = fitz.open(stream=content, filetype="pdf")
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid PDF file")
        
    # Build permission flags. Always allow accessibility.
    perm_flags = fitz.PDF_PERM_ACCESSIBILITY
    if can_print:
        perm_flags |= fitz.PDF_PERM_PRINT | fitz.PDF_PERM_PRINT_HIGH
    if can_modify:
        perm_flags |= fitz.PDF_PERM_MODIFY | fitz.PDF_PERM_ANNOTATE | fitz.PDF_PERM_ASSEMBLE
    if can_copy:
        perm_flags |= fitz.PDF_PERM_COPY

    output_stream = io.BytesIO()
    
    # Apply AES-256 encryption
    doc.save(
        output_stream,
        encryption=fitz.PDF_ENCRYPT_AES_256,
        owner_pw=owner_password or user_password or "owner",
        user_pw=user_password or "",
        permissions=perm_flags
    )
    
    output_stream.seek(0)
    
    return StreamingResponse(
        output_stream,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="encrypted_{file.filename}"'}
    )

@router.post("/optimize")
async def optimize_pdf(
    file: UploadFile = File(...),
    api_key: str | None = Depends(get_api_key)
):
    try:
        content = await file.read()
        doc = fitz.open(stream=content, filetype="pdf")
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid PDF file")
        
    try:
        # Aggressive image optimization: target 144 DPI (retina web quality) and 75% quality for JPEG
        doc.rewrite_images(dpi_threshold=150, dpi_target=144, quality=75)
    except Exception as e:
        # Ignore if rewriting images fails (some PDFs might have malformed image streams)
        pass

    output_stream = io.BytesIO()
    
    # Save with maximum compression and garbage collection
    # garbage=4: removes duplicates, unused objects, and compacts xref
    # deflate=True: compress uncompressed streams
    # clean=True: clean graphic streams
    doc.save(
        output_stream,
        garbage=4,
        deflate=True,
        clean=True
    )
    
    output_stream.seek(0)
    
    return StreamingResponse(
        output_stream,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="optimized_{file.filename}"'}
    )

def create_self_signed_cert():
    key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, u"US"),
        x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, u"California"),
        x509.NameAttribute(NameOID.LOCALITY_NAME, u"San Francisco"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, u"PDF Editor"),
        x509.NameAttribute(NameOID.COMMON_NAME, u"PDF Editor Self-Signed Certificate"),
    ])
    cert = x509.CertificateBuilder().subject_name(
        subject
    ).issuer_name(
        issuer
    ).public_key(
        key.public_key()
    ).serial_number(
        x509.random_serial_number()
    ).not_valid_before(
        datetime.datetime.now(datetime.UTC)
    ).not_valid_after(
        datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=365)
    ).add_extension(
        x509.SubjectAlternativeName([x509.DNSName(u"localhost")]),
        critical=False,
    ).sign(key, hashes.SHA256())
    
    cert_pem = cert.public_bytes(serialization.Encoding.PEM)
    key_pem = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    )
    return cert_pem, key_pem

@router.post("/sign")
async def sign_pdf(
    file: UploadFile = File(...),
    api_key: str | None = Depends(get_api_key)
):
    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid PDF file")
        
    cert_pem, key_pem = create_self_signed_cert()
    
    with tempfile.NamedTemporaryFile(delete=False) as cert_f, tempfile.NamedTemporaryFile(delete=False) as key_f:
        cert_f.write(cert_pem)
        key_f.write(key_pem)
        cert_path = cert_f.name
        key_path = key_f.name

    try:
        signer = signers.SimpleSigner.load(key_path, cert_path)
        
        in_pdf = io.BytesIO(content)
        out_pdf = io.BytesIO()
        
        # We need an IncrementalPdfFileWriter to append the signature
        w = IncrementalPdfFileWriter(in_pdf)
        
        signers.sign_pdf(
            w,
            signers.PdfSignatureMetadata(field_name='Signature1'),
            signer=signer,
            in_place=True
        )
        
        # IncrementalPdfFileWriter writes to the stream when in_place=False?
        # Actually in_place=True modifies the stream (in_pdf). Wait, if we use in_place=True,
        # we can just return in_pdf.
        in_pdf.seek(0)
        
        return StreamingResponse(
            in_pdf,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="signed_{file.filename}"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to sign PDF: {str(e)}")
    finally:
        os.unlink(cert_path)
        os.unlink(key_path)

@router.post("/redact")
async def redact_pdf(
    file: UploadFile = File(...),
    redactions: str = Form(...),
    api_key: str | None = Depends(get_api_key)
):
    try:
        import json
        redaction_data = json.loads(redactions)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid redaction data")

    try:
        content = await file.read()
        doc = fitz.open(stream=content, filetype="pdf")
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid PDF file")

    def hex_to_rgb(hex_color):
        hex_color = hex_color.lstrip('#')
        if len(hex_color) == 6:
            return tuple(int(hex_color[i:i+2], 16) / 255.0 for i in (0, 2, 4))
        return (0, 0, 0)

    try:
        for page_data in redaction_data:
            page_index = page_data.get('pageIndex')
            if page_index is None or page_index >= len(doc) or page_index < 0:
                continue
            
            page = doc[page_index]
            mediabox = page.mediabox
            
            for rect_data in page_data.get('rects', []):
                xp = rect_data.get('xPercent', 0)
                yp = rect_data.get('yPercent', 0)
                wp = rect_data.get('widthPercent', 0)
                hp = rect_data.get('heightPercent', 0)
                color = rect_data.get('color', '#000000')
                
                x0 = mediabox.x0 + (xp / 100.0) * mediabox.width
                y0 = mediabox.y0 + (yp / 100.0) * mediabox.height
                x1 = x0 + (wp / 100.0) * mediabox.width
                y1 = y0 + (hp / 100.0) * mediabox.height
                
                rect = fitz.Rect(x0, y0, x1, y1)
                rgb = hex_to_rgb(color)
                
                page.add_redact_annot(rect, fill=rgb)
                
            page.apply_redactions()

        output_stream = io.BytesIO()
        doc.save(output_stream)
        output_stream.seek(0)
        
        return StreamingResponse(
            output_stream,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="redacted_{file.filename}"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to apply redactions: {str(e)}")
