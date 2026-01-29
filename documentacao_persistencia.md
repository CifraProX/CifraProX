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
**Não é recomendado.** Embora o sistema utilize de forma **ESTRITA** o banco `cifraprox`, o banco `(default)` serve como infraestrutura base do Firebase.
> [!IMPORTANT]
> **Strict Mode Ativado:** O sistema foi atualizado para **NÃO** usar o banco `(default)` como fallback. Se a conexão com `cifraprox` falhar, o sistema apresentará um erro crítico para prevenir inconsistência de dados.

### O arquivo `.firebaserc` é necessário?
**Sim.** Ele é fundamental se você utiliza as ferramentas de linha de comando do Firebase (`firebase-tools`). Ele garante que, ao rodar comandos como `firebase deploy`, as regras de segurança e os arquivos do site sejam enviados para o projeto correto (`cifraprox-270126`).

---

> [!WARNING]
> O banco `(default)` do Firebase **não** deve conter dados de produção desta aplicação. O isolamento é forçado via código (Strict Mode).
