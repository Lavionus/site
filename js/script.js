// Tato verze funguje pouze ve vlastním prostředí, ne v Claude artifacts
document.addEventListener('DOMContentLoaded', () => {
    const myButton = document.getElementById('myButton');
    const themeToggleButton = document.getElementById('themeToggleButton');
    const body = document.body;
    const currentThemeSpan = document.getElementById('currentTheme');
    
    // Funkce pro aktualizaci textu o aktuálním motivu
    function updateThemeText(theme) {
        if (currentThemeSpan) {
            currentThemeSpan.textContent = ` (${theme === 'dark' ? 'tmavý' : 'světlý'})`;
        }
    }
    
    // Načtení preferovaného motivu z lokálního úložiště
    const savedTheme = localStorage.getItem('theme') || 'light';
    body.classList.add(`${savedTheme}-theme`);
    updateThemeText(savedTheme);
    
    // Event listener pro tlačítko "Klikni na mě!"
    if (myButton) {
        myButton.addEventListener('click', () => {
            alert('Ahoj! Klikl jsi na tlačítko.');
            console.log('Tlačítko bylo kliknuto!');
        });
    }
    
    // Event listener pro tlačítko přepínání motivu
    if (themeToggleButton) {
        themeToggleButton.addEventListener('click', () => {
            const currentTheme = body.classList.contains('light-theme') ? 'light' : 'dark';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            
            body.classList.remove(`${currentTheme}-theme`);
            body.classList.add(`${newTheme}-theme`);
            
            localStorage.setItem('theme', newTheme);
            updateThemeText(newTheme);
        });
    }
});
