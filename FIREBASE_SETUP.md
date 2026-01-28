# Configuração do Firebase (Serverless)

Este projeto foi migrado para uma arquitetura **Serverless** utilizando o Firebase. Isso elimina a dependência do backend local em Node.js para autenticação e gestão de usuários.

## 1. Visão Geral
*   **Autenticação:** Gerenciada pelo **Firebase Authentication**.
*   **Banco de Dados:** Utiliza o **Cloud Firestore** (NoSQL).
    *   Nome do Banco: `cifraprox` (Instância nomeada, não a `(default)`).
    *   Coleção Principal: `users`.
*   **Frontend:** Conecta diretamente via SDK Web (`app.js`).
*   **Backend (Legado):** A pasta `backend/` serve apenas para scripts de migração ou webhooks específicos (ex: Pagamentos), mas não é mais usada para login.

## 2. Configuração do Frontend (`app.js`)
No arquivo `app.js`, a conexão é inicializada com as credenciais públicas do projeto.

```javascript
// Exemplo de configuração em app.js
firebaseConfig: {
    apiKey: "SUA_API_KEY",
    authDomain: "seu-projeto.firebaseapp.com",
    projectId: "seu-projeto",
    // ...
},

init: async () => {
    // Inicializa Firebase
    firebase.initializeApp(app.firebaseConfig);
    
    // Conecta ao banco de dados específico 'cifraprox'
    // IMPORTANTE: Se usar o banco padrão, seria apenas firebase.firestore()
    app.db = firebase.firestore(firebase.app(), 'cifraprox');
    
    app.auth = firebase.auth();
}
```

## 3. Configuração do Banco de Dados (Firestore)
Para que o sistema funcione, o Firestore deve estar criado no Console do Firebase.

1.  Acesse o [Console do Firebase](https://console.firebase.google.com/).
2.  Vá em **Firestore Database**.
3.  Certifique-se de ter um banco de dados criado (o ID utilizado no código é `cifraprox`).
4.  **Regras de Segurança:** Para desenvolvimento/testes iniciais, certifique-se que as regras permitem leitura/escrita.
    ```
    allow read, write: if true; // (Perigoso para produção!)
    ```
    *Para produção, configure regras baseadas em `request.auth`.*

## 4. Migração de Dados (SQL -> Firebase)
Se você tem dados no PostgreSQL e quer enviar para o Firebase, use o script de migração.

### Pré-requisitos
1.  Gere uma **Chave Privada (Service Account)** no Console do Firebase:
    *   *Configurações do Projeto -> Contas de serviço -> Gerar nova chave privada*.
2.  Salve o arquivo JSON na raiz do projeto ou na pasta `backend/`.

### Rodando a Migração
O script está em `backend/migrate_to_firebase.js`.

1.  Edite o script para apontar para o caminho correto da sua chave JSON:
    ```javascript
    const serviceAccount = require('../cifraprox-sua-chave-privada.json');
    ```
2.  Instale as dependências:
    ```bash
    cd backend
    npm install firebase-admin pg
    ```
3.  Execute o script:
    ```bash
    node migrate_to_firebase.js
    ```

Isso copiará os usuários do PostgreSQL para o Firebase Auth e Firestore.

---
**Observação:** Como o hash de senhas do banco local não é compatível, o script define uma senha padrão temporária (ex: `mudar123`) para todos os usuários migrados.
