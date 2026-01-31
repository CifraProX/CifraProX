# Release v2.1.1-fix - Correção Crítica de Registro

## 🐛 Fixes

### 1. Correção de Erro de Serialização (Timestamp)
- **Problema**: O sistema estava falhando ao gravar novos usuários ou recuperar órfãos devido a uma incompatibilidade entre a versão antiga (Compat) e a nova (Modular) do Firebase SDK ao gerar a data de criação (`createdAt`).
- **Solução**: O código foi corrigido para usar o gerador de Timestamp da SDK Modular (`serverTimestamp()`) nativa quando estiver operando no modo de Banco Nomeado (`cifraprox`).
- **Impacto**: Corrige o erro `Unsupported field value: a custom bf object` que impedia o cadastro de funcionar corretamente.

## ⚠️ Instruções para Teste (Link Oficial)

1. Tente cadastrar **o mesmo email que falhou anteriormente** (ele deve entrar no fluxo de recuperação).
2. Se falhar, tente um email **totalmente novo**.
3. Em ambos os casos, verifique se a mensagem verde de sucesso aparece no console.

---
*Gerado por Antigravity AI - 30/01/2026*
