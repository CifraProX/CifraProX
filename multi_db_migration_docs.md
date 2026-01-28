# Documentação Técnica: Migração Multi-Banco (Hybrid Mode)

## 1. O Problema
O projeto utiliza o **Firebase Web SDK (Compat)**, que facilita a integração mas possui limitações críticas ao lidar com **Bancos de Dados Nomeados (Named Databases)** do Firestore.
*   O SDK Compat sempre aponta para o banco `(default)`.
*   Tentativas de usar hacks (`_delegate`) causavam instabilidade e erros de tipo (`FirebaseError`).
*   O objetivo era isolar os dados no banco `cifraprox` sem reescrever todo o projeto para o SDK Modular.

## 2. A Solução: Arquitetura Híbrida
Implementamos uma "Ponte" (Bridge) que permite ao código legado (`app.js`) acessar funções modernas do SDK Modular apenas quando necessário (para operações no banco `cifraprox`), mantendo o restante do app funcionando normalmente.

### Componentes Chave:
1.  **Bridge em `index.html`**: Carrega o SDK Modular (v10) e expõe funções vitais (`getFirestore`, `doc`, `setDoc`, `onSnapshot`, `getAuth`, etc.) no escopo global `window.firestoreUtils`.
2.  **Conexão Paralela**: O app inicia o Firebase normalmente (Compat), mas *também* cria uma conexão secundária via Bridge para o banco `cifraprox`, armazenada em `app.namedDb`.
3.  **Lógica Híbrida**: Nas funções críticas (`login`, `salvar`, `listar`), o código verifica:
    *   Se `app.namedDb` existe -> Usa SDK Modular (Escreve no `cifraprox`).
    *   Se não -> Usa SDK Compat (Fallback para `default`).

## 3. Alterações Realizadas

### A. `index.html`
*   **Atualização do SDK**: Migrado o script da Bridge para **Firebase v10.8.0** para garantir suporte correto a bancos nomeados.
*   **Exposição de Utils**: Adicionadas exportações de `getAuth`, `createUserWithEmailAndPassword`, `onSnapshot`, `query`, etc., para permitir operações complexas dentro do `app.js`.

### B. `app.js`
Refatoração de funções core para suportar a lógica híbrida:

1.  **`app.init`**:
    *   Removeu hacks de injeção de delegate.
    *   Agora armazena a conexão segura em `app.namedDb`.

2.  **`app.login`**:
    *   Usa `app.namedDb` para buscar/criar perfil do usuário.
    *   Garante que o usuário seja registrado no banco correto.
    *   Adicionados logs de debug (`[LOGIN] Usando Banco NOMEADO`).

3.  **`app.loadAdminUsers`**:
    *   Substituído `app.db.collection(...).onSnapshot` por `window.firestoreUtils.onSnapshot`.
    *   Permite listar usuários do `cifraprox` no painel administrativo.

4.  **`app.modalAddUser` (Cadastro Admin)**:
    *   Reescrito para **não usar API Fetch** (que falhava).
    *   Usa `createUserWithEmailAndPassword` com uma "App Secundária Temporária" para criar usuários sem deslogar o admin atual.
    *   Salva o perfil diretamente no Named DB.

5.  **`app.loadCifras`**:
    *   Adaptado para usar `onSnapshot` do SDK Modular quando disponível.
    *   Garante que a lista de músicas venha do `cifraprox`.

6.  **`app.saveCifra` e `app.deleteCifra`**:
    *   Implementada lógica híbrida para escrita (`addDoc/updateDoc/deleteDoc`).
    *   **Correção Crítica**: Removida uma **duplicata de código** no final do arquivo que sobrescrevia a função correta e causava o erro `checked of null`.

### C. `setup_admin.html`
*   Script auxiliar criado para garantir a criação do primeiro Admin no banco correto via SDK v10.

## 4. Status Atual
*   **Leitura**: ✅ Admin e Cifras leem do `cifraprox`.
*   **Escrita**: ✅ Login, Cadastro de Usuário e Cadastro de Cifras escrevem no `cifraprox`.
*   **Estabilidade**: ✅ Fallbacks implementados e erros de sintaxe corrigidos.
