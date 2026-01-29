# Documentação de Persistência - Banco 'cifraprox'

Esta documentação detalha como o sistema CifraProX interage com o banco de dados Firestore nomeado `cifraprox`. O projeto utiliza uma arquitetura híbrida (Bridge) para permitir que o código legado acesse funcionalidades modernas do Firebase.

## 1. Configuração e Inicialização

A configuração do Firebase está centralizada no objeto `app` dentro do arquivo `app.js`.

### Arquivo: `app.js` (Configuração)
```javascript
// Linhas 20-29
firebaseConfig: {
    apiKey: "AIzaSyDcx_MKD1ug5t_tEfyhYrmFkXBhlFssfyg",
    authDomain: "cifraprox-270126.firebaseapp.com",
    projectId: "cifraprox-270126",
    // ...
    databaseId: "cifraprox" // Identificador do banco de dados alvo
},
```

### Arquivo: `index.html` (A Ponte/Bridge)
Para conectar ao banco nomeado, usamos o SDK Modular (v10) em um script de módulo que expõe funções para o escopo global.

```javascript
// Linhas 1008-1013
window.connectToNamedDB = (config, dbName) => {
    console.log(`[BRIDGE] Conectando ao Firestore: ${dbName}`);
    const app = initializeApp(config, 'named-db-app'); // Instância secundária do App
    const db = getFirestore(app, dbName); // Conexão com o banco nomeado
    return db;
};

// Expose Utils for app.js (Linhas 1016-1019)
window.firestoreUtils = {
    doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, collection, getDocs, onSnapshot, query, orderBy, getFirestore,
    getAuth, createUserWithEmailAndPassword, initializeApp
};
```

---

## 2. Fluxo de Salvamento

O sistema prioriza o uso do `app.namedDb` (banco cifraprox). Se disponível, ele utiliza os utilitários da Bridge.

### Salvamento de Usuários (`app.js`)
Ocorre durante o login ou registro para garantir que o perfil do usuário exista no banco correto.

```javascript
// Linhas 450-466 (em app.login)
if (app.namedDb && window.firestoreUtils) {
    const { doc, getDoc, setDoc } = window.firestoreUtils;
    const userRef = doc(app.namedDb, 'users', uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
        // Criando perfil automaticamente no 'cifraprox'
        await setDoc(userRef, userData);
    }
}
```

### Salvamento de Cifras (`app.js`)
A função `app.saveCifra` lida com a criação e atualização de músicas.

```javascript
// Linhas 758-774 (em app.saveCifra)
if (app.namedDb && window.firestoreUtils) {
    const { doc, addDoc, updateDoc, collection } = window.firestoreUtils;
    
    if (id) {
        // ATUALIZAÇÃO
        const docRef = doc(app.namedDb, 'cifras', id);
        await updateDoc(docRef, payload);
    } else {
        // CRIAÇÃO
        const colRef = collection(app.namedDb, 'cifras');
        await addDoc(colRef, payload); // Salva nova cifra no 'cifraprox'
    }
}
```

---

## 3. Resumo dos Arquivos Envolvidos

| Arquivo | Responsabilidade |
| :--- | :--- |
| `index.html` | Carrega os SDKs (v9 Compat e v10 Modular) e estabelece a Bridge. |
| `app.js` | Inicializa o app, chama `connectToNamedDB` e executa a lógica de persistência. |
| `sw.js` | Gerencia o cache do PWA (Service Worker) usando o prefixo `cifraprox`. |
| `.firebaserc` | Mapeia o projeto local ao ID do projeto no Firebase (`cifraprox-270126`) para deploys via CLI. |

## 4. Perguntas Frequentes

### Posso excluir o banco `(default)`?
**Não é recomendado.** Embora o sistema utilize prioritariamente o banco `cifraprox`, o banco `(default)` é usado como **fallback** (mecanismo de segurança). Se a "Bridge" falhar por qualquer motivo (instabilidade de rede ou erro de carregamento do script), o app tentará usar o banco default para evitar um travamento completo.
> [!TIP]
> O ideal é manter o banco `(default)` criado, mas deixá-lo sem dados, servindo apenas como uma camada de segurança técnica.

### O arquivo `.firebaserc` é necessário?
**Sim.** Ele é fundamental se você utiliza as ferramentas de linha de comando do Firebase (`firebase-tools`). Ele garante que, ao rodar comandos como `firebase deploy`, as regras de segurança e os arquivos do site sejam enviados para o projeto correto (`cifraprox-270126`).

## 5. Guia para Replicação (Exemplo Mínimo)

Para replicar esta arquitetura em um novo projeto ou em outra parte deste sistema, siga este modelo essencial:

### A. Estrutura no `index.html`
Carregue os scripts e defina a Ponte (Bridge) antes do seu script principal.

```html
<!-- 1. SDKs Compat (Base do App) -->
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js"></script>

<!-- 2. Ponte para SDK Modular (Banco Nomeado) -->
<script type="module">
    import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
    import { getFirestore, doc, setDoc, addDoc, collection } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

    window.firestoreBridge = {
        initDB: (config, name) => getFirestore(initializeApp(config, 'db-' + name), name),
        utils: { doc, setDoc, addDoc, collection }
    };
</script>
```

### B. Inicialização no `app.js`
```javascript
const config = { 
    projectId: "seu-projeto-id", 
    apiKey: "sua-api-key",
    // ...
};

async function init() {
    // 1. Inicia o Firebase padrão
    firebase.initializeApp(config);
    
    // 2. Conecta ao banco específico (ex: 'cifraprox')
    // Aguarda a ponte carregar se necessário
    window.dbNamed = window.firestoreBridge.initDB(config, 'cifraprox');
}
```

### C. Uso Prático (Criar/Salvar)
```javascript
async function salvarDado(colecao, objeto) {
    const { collection, addDoc } = window.firestoreBridge.utils;
    
    // Alvo: Banco 'cifraprox' definido na inicialização
    const colRef = collection(window.dbNamed, colecao);
    await addDoc(colRef, objeto);
    
    console.log("Salvo com sucesso no banco nomeado!");
}
```

---

> [!IMPORTANT]
> O banco `(default)` do Firebase **não** é utilizado para os dados principais nesta configuração. O isolamento garantido pela instância nomeada permite que você tenha ambientes de dados separados sob o mesmo projeto.
