# Changelog

## [1.0.0] - 2026-02-18

### Adicionado
- Botão para excluir salas (funcionalidade de administrador/professor).
- Lógica de presença offline para melhor controle de conexões WebSocket/Firestore.

### Corrigido
- Erros de registro de usuários no `app_auth.js`.
- Problemas de acesso a salas para convidados e professores (`app_classroom.js`).
- Melhoria na estabilidade e tratamento de erros do `app_core.js`.

### Alterado
- Refatoração de componentes de autenticação e sessão.
- Atualização de arquivos de cache do Firebase (`.firebase/hosting..cache`).
