# CifraProX Release Notes - v2.2.0
**Data:** 31/01/2026
**Foco:** Correção Crítica de Acesso à Sala de Aula e Login de Visitante

## 🚀 Principais Alterações

### 🐛 Correções de Bugs (Critical Hotfixes)
- **Correção da "Tela Branca" ao acessar link da sala:**
  - Resolvido problema de *Race Condition* onde o script `app_v2.js` tentava inicializar antes do Firebase estar carregado. Implementada verificação segura de carregamento.
  - Corrigido erro de renderização onde a view `classroom` tentava renderizar no elemento `#main` (que não existia). Redirecionado para renderizar no `#app`.

- **Correção do Loop de Redirecionamento de Login:**
  - Resolvido problema onde usuários visitantes eram automaticamente redirecionados para o login ao tentar entrar na sala.
  - Implementada proteção no listener `onAuthStateChanged` para preservar a sessão do usuário visitante (`isGuest`).

- **Interface de "Entrar na Sala" (Modal):**
  - O Modal de Login/Visitante estava inacessível pois estava aninhado dentro de um template não renderizado (`view-login`).
  - **FIX:** Modal movido para o escopo global (`#modal-root`) garantindo que sempre possa ser exibido.

- **Tratamento de Erros de Sala:**
  - Adicionadas telas de erro amigáveis para "Sala não encontrada" e "Acesso Negado (Firestore)", substituindo o redirecionamento automático que causava confusão.
  - Atualização nas regras de segurança locais (`firestore.rules`) para permitir leitura pública da coleção `classrooms`.

### 🛠️ Melhorias Técnicas
- Adicionado rastreamento de stack trace no `navigate` para depuração de redirecionamentos.
- Refatoração da lógica de inicialização (`app.init`) para priorizar rotas de sala de aula.

## ⚠️ Ações Necessárias (Deploy)
- **Atualizar Regras do Firestore:** É necessário publicar as novas regras de segurança para permitir que visitantes acessem os dados das salas:
  ```javascript
  match /classrooms/{classroomId} {
    allow read: if true;
    allow write: if request.auth != null;
  }
  ```
