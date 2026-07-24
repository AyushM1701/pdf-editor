import os
import json
import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

def setup_s3():
    # Load environment variables from .env
    load_dotenv()

    aws_access_key = os.environ.get("AWS_ACCESS_KEY_ID")
    aws_secret_key = os.environ.get("AWS_SECRET_ACCESS_KEY")
    region = os.environ.get("AWS_REGION", "us-east-1")
    bucket_name = os.environ.get("S3_BUCKET_NAME", "hybrid-pdf-documents")

    if not aws_access_key or aws_access_key == "<YOUR_AWS_ACCESS_KEY_ID>":
        print("Error: AWS_ACCESS_KEY_ID is missing or not set properly in .env")
        return
    if not aws_secret_key or aws_secret_key == "<YOUR_AWS_SECRET_ACCESS_KEY>":
        print("Error: AWS_SECRET_ACCESS_KEY is missing or not set properly in .env")
        return

    print(f"Connecting to AWS S3 in region: {region}...")
    
    # Initialize S3 client
    s3_client = boto3.client(
        "s3",
        aws_access_key_id=aws_access_key,
        aws_secret_access_key=aws_secret_key,
        region_name=region
    )

    # 1. Create the bucket
    print(f"Checking if bucket '{bucket_name}' exists...")
    try:
        s3_client.head_bucket(Bucket=bucket_name)
        print(f"Bucket '{bucket_name}' already exists and you have access to it.")
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == '404':
            print(f"Bucket '{bucket_name}' does not exist. Creating it...")
            try:
                if region == "us-east-1":
                    s3_client.create_bucket(Bucket=bucket_name)
                else:
                    s3_client.create_bucket(
                        Bucket=bucket_name,
                        CreateBucketConfiguration={'LocationConstraint': region}
                    )
                print(f"Successfully created bucket '{bucket_name}'.")
            except ClientError as create_error:
                print(f"Failed to create bucket: {create_error}")
                return
        else:
            print(f"Error accessing bucket: {e}")
            return

    # 2. Configure CORS
    print("Configuring CORS policy for frontend uploads...")
    cors_configuration = {
        'CORSRules': [
            {
                'AllowedHeaders': ['*'],
                'AllowedMethods': ['PUT', 'GET', 'POST'],
                'AllowedOrigins': ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173', 'http://localhost:8080'],
                'ExposeHeaders': []
            }
        ]
    }

    try:
        s3_client.put_bucket_cors(
            Bucket=bucket_name,
            CORSConfiguration=cors_configuration
        )
        print("Successfully configured CORS policy.")
    except ClientError as e:
        print(f"Failed to configure CORS: {e}")

if __name__ == "__main__":
    setup_s3()
