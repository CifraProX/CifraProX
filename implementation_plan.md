# Plano de Implementação: Fallback de Segurança para Timestamps

## Problema
Usuários enfrentam erros de "Email já registrado" ao usar emails novos.
Isso ocorre devido a uma condição de corrida:
1. A primeira tentativa cria o usuário no Auth, mas falha ao gravar no banco porque `serverTimestamp` não existe (devido ao cache antigo do `index.html`).
2. O usuário clica novamente (ou o sistema retenta), caindo no erro `auth/email-already-in-use`.
3. A recuperação (Recovery Flow) também falha pelo mesmo motivo (falta de `serverTimestamp`), exibindo a mensagem genérica de erro.

## Solução Proposta
Blindar o código `app_v2.js` contra a falta de `serverTimestamp`. Se a função não estiver disponível (cache antigo), usaremos `new Date()` ou `new Date().toISOString()` como fallback. Isso garante que o registro funcione imediatamente sem obrigar o usuário a limpar cache.

## Alterações Planejadas

### `c:\Users\Saulero\Desktop\Cifraprox\CifraProX\app_v2.js`

#### [Fluxo Principal de Registro]
- Alterar a obtenção do timestamp.
- **De**: `userData.createdAt = serverTimestamp();`
- **Para**: Verificação se `serverTimestamp` é função. Se não for, usar `new Date()`.

#### [Fluxo de Recuperação (Recovery)]
- Aplicar a mesma lógica de fallback no bloco de recuperação de usuário órfão.

## Verificação
- **Manual**: Tentar registrar novo usuário. Mesmo se `index.html` for antigo, o código JS terá o fallback e prosseguirá com sucesso.
