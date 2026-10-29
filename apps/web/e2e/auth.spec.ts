import { expect, test } from '@playwright/test';
import { newProject, PASSWORD, signup, uniqueEmail } from './helpers';

test.describe('autenticação e projetos', () => {
  test('cadastra, cria projeto vertical, mantém a sessão ao recarregar e sai', async ({ page }) => {
    await signup(page, 'Maria');
    await expect(page.getByText('Maria')).toBeVisible();
    await expect(page.getByText('Nenhum projeto ainda')).toBeVisible();

    await newProject(page, 'Meu vertical', '9:16');
    const settings = await page.evaluate(() => window.__editor.getState().project.settings);
    expect(settings).toMatchObject({ width: 1080, height: 1920 });
    await expect(page.getByTestId('topbar').getByLabel('Nome do projeto')).toHaveValue('Meu vertical');

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Meu vertical' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Seus projetos' })).toBeVisible();

    await page.getByRole('button', { name: 'Sair' }).click();
    // ao sair, a raiz volta a mostrar a landing page (e não a tela de login)
    await expect(page.getByTestId('landing')).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    await page.goto('/p/qualquer-projeto');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('tab', { name: 'Entrar' })).toBeVisible();
  });

  test('mostra erros de login e de cadastro', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(uniqueEmail());
    await page.getByLabel('Senha').fill('senha-errada-1');
    await page.getByRole('button', { name: 'Entrar' }).last().click();
    await expect(page.getByRole('alert')).toContainText('E-mail ou senha inválidos');

    await page.getByRole('tab', { name: 'Criar conta' }).click();
    await page.getByLabel('Nome').fill('X');
    await page.getByLabel('E-mail').fill(uniqueEmail());
    await page.getByLabel('Senha').fill('curta');
    await page.getByRole('button', { name: 'Criar conta' }).last().click();
    await expect(page.getByRole('alert')).toContainText('Senha');
  });

  test('e-mail duplicado é recusado e login funciona com a conta criada', async ({ page, context }) => {
    const { email } = await signup(page);
    await page.getByRole('button', { name: 'Sair' }).click();
    // depois de sair aparece a landing: o botão "Criar conta" do cabeçalho leva ao cadastro
    await page.getByTestId('header-signup').click();
    await expect(page.getByRole('tab', { name: 'Criar conta' })).toHaveAttribute('aria-selected', 'true');
    await page.getByLabel('Nome').fill('Outro');
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Senha').fill(PASSWORD);
    await page.getByRole('button', { name: 'Criar conta' }).last().click();
    await expect(page.getByRole('alert')).toContainText('já cadastrado');

    await page.getByRole('tab', { name: 'Entrar' }).click();
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Senha').fill(PASSWORD);
    await page.getByRole('button', { name: 'Entrar' }).last().click();
    await expect(page.getByRole('heading', { name: 'Seus projetos' })).toBeVisible();
    await context.clearCookies();
  });

  test('exclui projeto com confirmação e projeto inexistente mostra aviso', async ({ page }) => {
    await signup(page);
    await newProject(page, 'Descartável');
    await page.goto('/');
    await page.getByRole('button', { name: 'Mais ações para Descartável' }).click({ force: true });
    await page.getByRole('menuitem', { name: 'Excluir Descartável' }).click();
    await page.getByRole('button', { name: 'Excluir definitivamente' }).click();
    await expect(page.getByText('Nenhum projeto ainda')).toBeVisible();
    await page.goto('/p/nao-existe');
    await expect(page.getByText('Projeto não encontrado.')).toBeVisible();
  });
});
