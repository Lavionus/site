// js/script.js
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
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        body.classList.remove('light-theme', 'dark-theme'); // Odebereme defaultní
        body.classList.add(`${savedTheme}-theme`);
        updateThemeText(savedTheme);
    } else {
        // Pokud není nic uloženo, použijeme výchozí (light-theme)
        body.classList.add('light-theme');
        updateThemeText('light');
    }

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
            if (body.classList.contains('light-theme')) {
                body.classList.remove('light-theme');
                body.classList.add('dark-theme');
                localStorage.setItem('theme', 'dark');
                updateThemeText('dark');
            } else {
                body.classList.remove('dark-theme');
                body.classList.add('light-theme');
                localStorage.setItem('theme', 'light');
                updateThemeText('light');
            }
        });
    }
});
