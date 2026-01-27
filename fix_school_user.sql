-- Verificar usuários existentes
SELECT id, name, email, role, status, plan_id FROM users ORDER BY id;

-- Se você quiser atualizar um usuário específico para school:
-- DESCOMENTE a linha abaixo e substitua 'email@escola.com' pelo email correto

-- UPDATE users SET role = 'school', plan_id = 4, status = 'active' WHERE email = 'escola@teste.com';

-- Verificar novamente
SELECT id, name, email, role, status, plan_id FROM users WHERE role = 'school';
