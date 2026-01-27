# Documentação Técnica - CifrasProX

## 1. Visão Geral
O **CifrasProX** é uma aplicação web progressiva (PWA) desenvolvida para músicos, focada na gestão, edição e visualização de cifras musicais e repertórios. O sistema permite criar e importar cifras, organizar setlists para apresentações, transpor tons e visualizar acordes e tablaturas, funcionando tanto online quanto offline.

## 2. Arquitetura e Tecnologias

O projeto segue uma arquitetura **Single Page Application (SPA)** construída com **Vanilla JavaScript** (sem frameworks como React ou Vue), priorizando leveza e performance. O backend é Serverless, utilizando os serviços do **Google Firebase**.

### Stack Tecnológica
- **Frontend:** HTML5, CSS3, JavaScript (ES6+).
- **Backend (BaaS):** Firebase (Google).
  - **Firestore (NoSQL):** Armazenamento de cifras, repertórios e dados de usuário.
  - **Authentication:** Gerenciamento de login e sessões.
- **PWA (Progressive Web App):** Suporte a instalação em dispositivos móveis e desktop, com cache offline via Service Workers.
- **APIs Externas:**
  - **YouTube IFrame API:** Integração para tocar as músicas e vídeos de treino dentro da cifra.
  - **AllOrigins:** Proxy para contornar CORS na importação de cifras de sites externos (ex: Cifra Club).

## 3. Estrutura de Diretórios e Arquivos

A estrutura do projeto é plana e simples, facilitando o desenvolvimento e deploy estático.

| Arquivo / Pasta | Descrição |
| :--- | :--- |
| **`/`** (Raiz) | |
| `index.html` | Ponto de entrada da aplicação. Contém a estrutura base (header, main) e os templates (`<template>`) das visualizações (Home, Editor, Cifra, etc). |
| `app.js` | Core da aplicação. Gerencia o roteamento, estado global, comunicação com Firebase, lógica de negócios e manipulação do DOM. |
| `chords.js` | Biblioteca proprietária para renderização dinâmica de acordes (SVG). Mantém um dicionário de formas e desenha as posições no braço do violão. |
| `style.css` | Folha de estilos global. Contém as variáveis CSS (temas claro/escuro) e estilização de todos os componentes. |
| `sw.js` | Service Worker. Responsável pelo cache de arquivos estáticos (HTML, CSS, JS, Imagens) permitindo o funcionamento offline. |
| `manifest.json` | Arquivo de configuração do PWA (nome, ícones, cores, display mode). |
| `logo.png` | Ícone principal da aplicação. |
| **`icons/`** | Diretório contendo ícones vetoriais (SVG) para batidas e ritmos. |
| **`.git/`** | Controle de versão Git. |

## 4. Funcionamento Interno e Componentes

### 4.1. Roteamento (Router)
O roteamento é manual e baseado em **Hash Navigation** (`#view/param`).
- A função `app.navigate(view, param)` no `app.js` intercepta a navegação.
- O sistema clona o conteúdo de tags `<template id="view-{nome}">` do `index.html` e injeta no container principal `<main id="app">`.
- Isso garante que apenas o conteúdo necessário seja renderizado, mantendo a experiência fluida de SPA.

### 4.2. Gerenciamento de Estado
O estado da aplicação é centralizado no objeto `app.state`:
```javascript
state: {
    user: null,          // Dados do usuário logado (ou null para visitante)
    currentCifra: null,  // Dados da cifra sendo visualizada
    cifras: [],          // Cache local da lista de cifras (sincronizado com Firestore)
    setlists: [],        // Lista de repertórios
    currentSetlist: null // Repertório ativo no momento
    // ...
}
```

### 4.3. Banco de Dados (Firestore)
A estrutura de dados no Firestore é dividida em coleções principais:
- **`cifras`**: Documentos contendo título, artista, conteúdo (letra+cifra), configurações de tom, capo e metadados.
- **`setlists`**: Documentos que agrupam IDs de cifras em uma ordem específica para shows.
- **`custom_chords`**: (Opcional) Definições de acordes personalizados.

> **Modo Offline:** O Firestore é configurado com persistência habilitada (`enablePersistence`), permitindo que o app leia e escreva dados mesmo sem internet. As mudanças são sincronizadas quando a conexão retorna.

### 4.4. Sistema de Cifras e Acordes
- **Importação:** O sistema faz scraping de cifras externas usando um proxy para evitar bloqueios de CORS, parseando o HTML para o formato interno.
- **Formato Interno:** As cifras são armazenadas em texto, com acordes entre colchetes (ex: `[Am7]`).
- **Renderização:** Na visualização, o `app.js` detecta os padrões `[...]` e os transforma em elementos interativos que exibem o desenho do acorde (via `chords.js`) ao passar o mouse.

## 5. Instalação e Configuração

### Pré-requisitos
- Um servidor web simples para arquivos estáticos (não requer NodeJS/PHP/Python no servidor, apenas para servir os arquivos).
- Conta no Firebase (para backend).

### Passo a Passo

1.  **Clonar o Repositório:**
    ```bash
    git clone https://github.com/BlackZurry/CifrasProX.git
    cd CifrasProX
    ```

2.  **Configurar Firebase (Obrigatório para funcionalidades completas):**
    - Crie um projeto no Console do Firebase.
    - Habilite **Firestore Database** e **Authentication** (Email/Senha).
    - No arquivo `app.js`, localize o objeto `firebaseConfig` (linhas 15-24) e substitua pelos dados do seu projeto.

3.  **Executar Localmente:**
    Você pode usar qualquer servidor estático. Exemplo com extensão "Live Server" do VS Code ou Python:
    ```bash
    # Com Python 3
    python -m http.server 8000
    ```
    Acesse `http://localhost:8000`.

## 6. Guia de Desenvolvimento

- **Novas Funcionalidades:** Adicione a lógica no `app.js` e a interface no `index.html` (dentro de um novo `<template>` ou existente).
- **Estilização:** Utilize variáveis CSS no `style.css` para manter a consistência com o tema Dark/Light.
- **Acordes:** Novos desenhos de acordes devem ser adicionados ao dicionário `dict` no `chords.js` ou via banco de dados na coleção `custom_chords`.

---
*Gerado por Antigravity Agent em 27/01/2026.*
