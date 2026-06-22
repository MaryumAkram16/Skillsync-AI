async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/trending-skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'Frontend Developer', country: 'Worldwide' })
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Response:', text);
  } catch (e) {
    console.error('Error:', e);
  }
}
test();
