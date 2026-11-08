import urllib.request
import re
import os

url = "https://poly.pizza/m/2afe2aca-5754-44b3-bf22-411adcd6fb12"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as resp:
        html = resp.read().decode('utf-8', errors='ignore')
    
    matches = re.findall(r'https://[^\s"\'<>]+\.glb', html)
    print("Found matches:", matches)
    if matches:
        glb_url = matches[0]
        out_path = os.path.join("MySpecsLens.esproj", "Assets", "Modern_House.glb")
        print(f"Downloading from {glb_url} to {out_path}...")
        urllib.request.urlretrieve(glb_url, out_path)
        print(f"Downloaded! Size: {os.path.getsize(out_path)} bytes")
except Exception as e:
    print("Error:", e)
