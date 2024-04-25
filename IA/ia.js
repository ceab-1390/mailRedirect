
import ollama from 'ollama'

async function question(question) {
    const response = await ollama.chat({
        model: 'llama3',
        messages: [{ role: 'user', content: question }],
      });
      return response.message.content
}

export default question;


