# Release v2.1.0-debug - Diagnóstico de Banco de Dados

## 🐛 Debugging & Fixes

### 1. Diagnóstico de Conexão Firestore
- **Verificação de Banco Nomeado**: O sistema agora verifica explicitamente na inicialização se está conectado ao banco correto (`cifraprox`).
- **Alerta de Segurança**: Se o sistema detectar conexão com o banco `(default)`, um alerta (`alert`) será exibido na tela imediatamente, avisando que a configuração está incorreta. Isso impede que dados sejam gravados no local errado sem aviso.

### 2. Rastreamento de Registro (Sign Up)
- **Logs Detalhados**: Adicionados logs visuais (`[DEBUG CRÍTICO]`) no console do navegador (F12) durante o processo de registro.
- **Confirmação de Escrita**: O sistema agora loga exatamente em qual coleção e banco de dados o perfil do usuário está sendo salvo.
- **Tratamento de Erros**: Mensagens de erro de banco de dados agora são exibidas completas no alerta, facilitando o diagnóstico.

## ⚠️ Instruções para Teste (Link Oficial)

1. Acesse a aplicação no link oficial.
2. **Importante**: Abra o Console do Navegador (F12) antes de interagir.
3. Tente criar uma nova conta.
4. Observe:
   - Se aparecer um **Alerta na Tela** dizendo que está no banco `(default)`, o problema é a configuração do Firebase (API Key ou permissão do banco nomeado).
   - Se não aparecer alerta, verifique no Console (F12) as mensagens coloridas iniciadas por `[DEBUG CRÍTICO]`.

---
*Gerado por Antigravity AI - 30/01/2026*
