import urllib.request
import json

url = "https://api.github.com/repos/radardocampo/radardocampohub1.0/pulls"
headers = {
    "Authorization": "token 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",
    "Accept": "application/vnd.github.v3+json",
    "Content-Type": "application/json"
}
data = {
    "title": "feat: Adiciona aba Melhorar Imagem e permite personalizar instrução (prompt)",
    "body": "Este Pull Request implementa a nova aba 'Melhorar Imagem' no Assistente IA, consumindo o modelo `gemini-3.1-flash-image` através de uma nova Edge Function. Além disso, permite editar as instruções iniciais dos 3 módulos (Análise, Títulos e Tags, e Imagem) via banco de dados (tabela `ai_prompt_settings`).",
    "head": "feature/aba-melhorar-imagem",
    "base": "main"
}

req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers=headers)
try:
    with urllib.request.urlopen(req) as response:
        result = json.loads(response.read().decode('utf-8'))
        print("Pull request successfully created!")
        print("URL:", result["html_url"])
        print("Number:", result["number"])
except urllib.error.HTTPError as e:
    print("Failed to create Pull Request.")
    print("Error code:", e.code)
    print("Error reason:", e.reason)
    print("Error body:", e.read().decode('utf-8'))
except Exception as e:
    print("An error occurred:", e)
