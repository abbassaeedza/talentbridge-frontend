import { expect, test } from '@playwright/test';

const company = {
  id: '00000000-0000-0000-0000-000000000020',
  email: 'company@talentbridge.com',
  firstName: 'Nexa',
  lastName: 'Systems',
  role: 'COMPANY',
  status: 'APPROVED',
  onboardingComplete: true,
};

test('fills empty project fields from the company chatbot draft', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('accessToken', 'company-test-token'));
  await page.route('**/api/users/me', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify(company),
  }));
  await page.route('**/api/users/notifications**', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ notifications: [], unreadCount: 0 }),
  }));
  await page.route('**/api/chat', async route => {
    const body = route.request().postDataJSON();
    expect(body.context).toBe('COMPANY_PROJECT_CREATION');
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        message: 'I filled the project draft from your brief.',
        model: 'gpt-4o-mini',
        projectDraft: {
          title: 'AI Customer Support Portal',
          description: 'A portal that helps support agents answer customer questions.',
          scope: 'Build the web portal and searchable knowledge base.',
          deliverables: 'Working application and documentation.',
          evaluationCriteria: 'Usability, accuracy, and code quality.',
          projectField: 'Software',
          tools: ['React', 'Spring Boot'],
        },
      }),
    });
  });

  await page.goto('/company/projects/new');
  await expect(page.getByRole('heading', { name: 'Post a New Project' })).toBeVisible();
  await page.getByRole('button', { name: 'Open AI assistant' }).click();
  await page.getByPlaceholder('Ask about TalentBridge…').fill('Create an AI support portal using React and Spring Boot');
  await page.getByRole('button', { name: 'Send message' }).click();

  await expect(page.getByPlaceholder('e.g. AI-Powered Customer Support Chatbot')).toHaveValue('AI Customer Support Portal');
  await expect(page.getByPlaceholder('What is the project about? What problem does it solve?')).toHaveValue(/support agents/);
  await expect(page.getByRole('button', { name: 'Software' })).toHaveClass(/border-ember-500/);
  await expect(page.getByText('Spring Boot', { exact: true })).toBeVisible();
});
