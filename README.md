# ⚡ Quiz Relâmpago — Quiz Interativo Multitemático

Jogo de perguntas e respostas no estilo *show de perguntas*: **10 segundos por pergunta**, 4 alternativas, sons sintéticos e um **Modo Apresentação/TV** para jogar em família ou na sala de aula.

Feito com **HTML5 + CSS3 + JavaScript puro**. Não usa frameworks, `npm` nem *build*. É só subir os arquivos no GitHub e ativar o GitHub Pages.

---

## ✨ Funcionalidades

| Recurso | Detalhes |
|---|---|
| ⏱️ **Cronômetro de 10s** | Anel circular + barra fluida que muda de cor: **verde** (10–6s) → **laranja** (5–3s) → **vermelho pulsante** (2–0s). |
| ✅ **Revelação** | Ao fim dos 10s a correta fica **verde**, as erradas **vermelhas**, aparece uma explicação/curiosidade e o botão **"Próxima pergunta"**. |
| 🎮 **Modo Interativo** | Responda clicando ou pelo teclado. Acerto = 500 pts + até 500 de bônus pela rapidez. Mostra sequências de acertos 🔥. |
| 📺 **Modo Apresentação/TV** | Ninguém clica: a pergunta aparece, o tempo corre e a resposta é revelada sozinha. Fontes maiores em telas grandes. |
| ⚙️ **Opções** | Avanço automático 3s após revelar · Revelar logo após responder (ou esperar os 10s, que é o padrão). |
| 🔊 **Sons (Web Audio API)** | Tic-tac nos últimos 3s, acerto, erro, tempo esgotado e fanfarra final, todos gerados por código (sem arquivos `.mp3`). Botão de mudo no cabeçalho, e a escolha fica salva. |
| 🏁 **Placar final** | Pontuação, % de acertos, tempo médio de resposta, maior sequência, medalha 🥇🥈🥉, recorde por tema e revisão das erradas com explicação. |
| 🔀 **Sem repetição** | Nenhuma pergunta se repete na mesma partida. Alternativas são embaralhadas a cada vez. O jogo também prioriza perguntas que você ainda não viu recentemente. |
| 📱 **Responsivo** | Desktop, tablet e celular. |
| ⌨️ **Atalhos** | `1`–`4` ou `A`–`D` responder · `Enter`/`Espaço`/`→` próxima · `M` som · `Esc` sair. |

### 📚 Categorias (156 perguntas)

| Categoria | Qtde | Conteúdo |
|---|---|---|
| 🌎 Geografia | 36 | 13 **capitais do Brasil** · 12 **bandeiras** (com imagem) · 11 **continentes** |
| ➗ Matemática | 20 | Cálculo mental, porcentagem, frações, regra de três, potências, geometria |
| 🧩 Raciocínio Lógico | 20 | Sequências numéricas e alfabéticas, charadas, silogismos, deduções |
| 📖 Bíblico | 20 | Personagens, livros, milagres, parábolas, reis e profetas |
| 🇺🇸 Inglês | 20 | Vocabulário, *idioms*, *false friends*, tempos verbais, lacunas |
| 🇪🇸 Espanhol | 20 | *Heterosemánticos* (embarazada, exquisito, oficina…), conjugações, expressões |
| 💡 Conhecimentos Gerais | 20 | História do Brasil e mundial, ciências, astronomia, literatura, inventos |
| 🎲 Todas Misturadas | 156 | Sorteia de todas, equilibrando as categorias |

As bandeiras vêm de `https://flagcdn.com/w320/{código}.png`. Se a imagem falhar, o jogo tenta a versão SVG (`https://flagcdn.com/{código}.svg`) e, por último, mostra o emoji da bandeira.

---

## 📁 Estrutura

```
quiz-interativo/
├── index.html                  # Estrutura das telas (início, jogo, resultados)
├── style.css                   # Visual, animações e responsividade
├── app.js                      # Lógica: rodada, cronômetro, sons, pontuação
├── questions.json              # Banco de questões (edite à vontade!)
├── .nojekyll                   # Faz o GitHub Pages servir os arquivos como estão
├── tools/
│   └── validate-questions.js   # Validador opcional do banco (Node.js)
└── README.md
```

Todos os caminhos são relativos (`./`), então o site funciona em `https://usuario.github.io/nome-do-repositorio/` sem nenhum ajuste.

---

## 🧪 Testar localmente

O jogo carrega `questions.json` via `fetch`, e **os navegadores bloqueiam isso quando o `index.html` é aberto com dois cliques** (`file://`). Use um servidor local simples, escolhendo **uma** das opções:

**Python (já vem no macOS/Linux; no Windows instale em python.org):**

```bash
cd quiz-interativo
```

```bash
python -m http.server 8000
```

**Node.js:**

```bash
npx serve .
```

**VS Code:** instale a extensão **Live Server** e clique em *Go Live*.

Depois abra **http://localhost:8000** (ou o endereço mostrado no terminal).

Validar o banco de questões depois de editar (opcional, requer Node.js):

```bash
node tools/validate-questions.js
```

---

## 🚀 Publicar no GitHub Pages (passo a passo)

### Opção A — pelo site do GitHub (sem instalar nada)

1. Acesse **https://github.com** e faça login (ou crie uma conta gratuita).
2. Clique em **"+" → New repository** (canto superior direito).
3. Em **Repository name** digite, por exemplo, `quiz-interativo`. Marque **Public** e clique em **Create repository**.
4. Na página do repositório vazio, clique no link **"uploading an existing file"**.
5. **Arraste todos os arquivos e pastas** do projeto (`index.html`, `style.css`, `app.js`, `questions.json`, `README.md`, `.nojekyll` e a pasta `tools`) para a área de upload.
   > 💡 O `.nojekyll` começa com ponto e pode estar oculto. No Windows, ative *Exibir → Itens ocultos*; no macOS, use `Cmd + Shift + .`. Ele é opcional, então o site funciona mesmo sem ele.
6. Clique em **Commit changes**.
7. Vá em **Settings → Pages** (menu lateral).
8. Em **Build and deployment → Source**, escolha **Deploy from a branch**.
9. Em **Branch**, selecione **`main`** e a pasta **`/ (root)`**, e clique em **Save**.
10. Aguarde 1 a 2 minutos e recarregue a página. Aparecerá o link:
    **`https://SEU-USUARIO.github.io/quiz-interativo/`** 🎉

### Opção B — pelo terminal (Git)

Primeiro crie o repositório vazio no GitHub (passos 1–3 acima). Depois, dentro da pasta do projeto, rode um comando por vez:

```bash
git init
```

```bash
git add .
```

```bash
git commit -m "Quiz Relâmpago: primeira versão"
```

```bash
git branch -M main
```

```bash
git remote add origin https://github.com/SEU-USUARIO/quiz-interativo.git
```

```bash
git push -u origin main
```

Em seguida ative o Pages em **Settings → Pages → Branch: `main` / `(root)` → Save** (passos 7–10).

> ℹ️ Como o projeto não tem *build step*, **não é necessário nenhum workflow** em `.github/workflows`. O GitHub Pages publica direto da branch `main`. Cada novo `git push` atualiza o site em cerca de 1 minuto.

---

## ✏️ Adicionar ou editar perguntas

Abra `questions.json` e adicione um objeto em `"questions"`:

```json
{
  "id": "ger-21",
  "category": "gerais",
  "question": "Qual é o menor país do mundo?",
  "options": ["Vaticano", "Mônaco", "San Marino", "Malta"],
  "answer": 0,
  "explanation": "O Vaticano tem cerca de 0,44 km²."
}
```

- `category`: um dos IDs `geografia`, `matematica`, `logica`, `biblico`, `ingles`, `espanhol`, `gerais`.
- `options`: exatamente 4 alternativas. **`answer`** é o índice (0–3) da correta. A ordem na tela é sempre embaralhada.
- `id`: único (o validador confere).
- Perguntas de bandeira: use `"subtype": "bandeiras"` e `"flag": "xx"`, com o código ISO 3166-1 alfa-2 em minúsculas (ex.: `"fr"`, `"eg"`, `"nz"`). Veja a lista em https://flagcdn.com/pt/codes.json.
- Em Geografia, o campo `subtype` (`capitais`, `bandeiras`, `continentes`) faz o jogo sortear os três tipos de forma equilibrada.

Depois rode `node tools/validate-questions.js` para conferir.

---

## 🛠️ Tecnologias

- HTML5 semântico com atributos ARIA (navegável por teclado e leitor de tela)
- CSS3: variáveis, Grid, Flexbox, animações, `prefers-reduced-motion`
- JavaScript ES2020+ puro: `fetch`, `requestAnimationFrame`, Web Audio API, `localStorage`
- Fonte [Poppins](https://fonts.google.com/specimen/Poppins) (Google Fonts) · Bandeiras: [flagcdn.com](https://flagcdn.com)

Bom jogo! ⚡
