import { expect, test } from '@playwright/test';
import { newProject, signup } from './helpers';

test.describe('projetos fixados', () => {
  test('Fixar no topo move o projeto para a frente, mostra o selo e continua depois de recarregar', async ({ page }) => {
    await signup(page);
    await newProject(page, 'Primeiro projeto');
    await page.goto('/');
    await newProject(page, 'Segundo projeto');
    await page.goto('/');
    const titles = () => page.getByTestId('project-grid').locator('h2').allTextContents();
    await expect.poll(titles).toEqual(['Segundo projeto', 'Primeiro projeto']); // mais recente primeiro
    await page.getByRole('button', { name: 'Mais ações para Primeiro projeto' }).click();
    await page.getByRole('menuitem', { name: 'Fixar no topo Primeiro projeto' }).click();
    await expect.poll(titles).toEqual(['Primeiro projeto', 'Segundo projeto']);
    await expect(page.getByTestId('pinned-badge')).toHaveCount(1);
    await page.reload();
    await expect.poll(titles).toEqual(['Primeiro projeto', 'Segundo projeto']);
    await page.getByRole('button', { name: 'Mais ações para Primeiro projeto' }).click();
    await page.getByRole('menuitem', { name: 'Desafixar Primeiro projeto' }).click();
    await expect.poll(titles).toEqual(['Segundo projeto', 'Primeiro projeto']);
    await expect(page.getByTestId('pinned-badge')).toHaveCount(0);
  });
});


test.describe('busca de projetos', () => {
  test('contagem acompanha o filtro, o botão limpa, Esc limpa e / foca o campo', async ({ page }) => {
    await signup(page);
    await newProject(page, 'Alpha');
    await page.goto('/');
    await newProject(page, 'Beta');
    await page.goto('/');
    await expect(page.getByTestId('project-count')).toHaveText('· 2 projetos');
    const search = page.getByLabel('Buscar projetos');
    await expect(page.getByTestId('clear-search')).toHaveCount(0);
    await search.fill('alp');
    await expect(page.getByTestId('project-count')).toHaveText('· 1 de 2 projetos');
    await expect(page.getByTestId('project-grid').locator('h2')).toHaveText(['Alpha']);
    await page.getByTestId('clear-search').click();
    await expect(search).toHaveValue('');
    await expect(search).toBeFocused();
    await expect(page.getByTestId('project-count')).toHaveText('· 2 projetos');
    await search.fill('zzz');
    await expect(page.getByText('Nenhum projeto corresponde')).toBeVisible();
    await search.press('Escape');
    await expect(search).toHaveValue('');
    // "/" fora de um campo leva o foco para a busca
    await page.locator('body').click({ position: { x: 700, y: 600 } });
    await page.keyboard.press('/');
    await expect(search).toBeFocused();
    await expect(search).toHaveValue('');
  });
});
