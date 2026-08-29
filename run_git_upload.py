import subprocess
import os

try:
    result = subprocess.run(["git", "push", "origin", "jules-10825728804056170586-05361ed2:feature/aba-melhorar-imagem"], capture_output=True, text=True)
    print("STDOUT:", result.stdout)
    print("STDERR:", result.stderr)
except Exception as e:
    print("Error:", str(e))
