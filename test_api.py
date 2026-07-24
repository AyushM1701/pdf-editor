import urllib.request
req = urllib.request.Request("https://pdf-editor-lkkr.onrender.com/api/extraction/status/4d7f59ea-3edd-437e-8b7e-47daf5d36c63")
try:
    print(urllib.request.urlopen(req).read().decode())
except Exception as e:
    print(e.read().decode())
