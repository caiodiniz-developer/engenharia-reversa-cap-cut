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
