from dotenv import load_dotenv
load_dotenv()
import os
from groq import Groq

key = os.environ.get("GROQ_API_KEY")
print(f"API Key found: {key[:15]}..." if key else "NO API KEY FOUND")

client = Groq(api_key=key)
res = client.chat.completions.create(
    model="llama-3.3-70b-versatile",
    messages=[{"role": "user", "content": "say hello"}]
)
print("Groq Response:", res.choices[0].message.content)