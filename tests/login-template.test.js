const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ejs = require('ejs');

test('demo login buttons submit through the existing login route', async () => {
  const html = await ejs.renderFile(
    path.join(__dirname, '..', 'views', 'login.ejs'),
    {
      title: 'Sign in',
      demoLoginAvailable: true,
      flash: null
    }
  );

  assert.equal((html.match(/<form action="\/login" method="post">/g) || []).length, 5);
  assert.doesNotMatch(html, /\/login\/demo\//);
  for (const username of [
    'customer1',
    'customer2',
    'staff1',
    'staff2',
    'admin1'
  ]) {
    assert.match(
      html,
      new RegExp(`<input type="hidden" name="username" value="${username}">`)
    );
  }
});
