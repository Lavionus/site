// js/script.js
document.addEventListener('DOMContentLoaded', () => {
    const myButton = document.getElementById('myButton');

    if (myButton) {
        myButton.addEventListener('click', () => {
            alert('Ahoj! Klikl jsi na tlačítko.');
            console.log('Tlačítko bylo kliknuto!');
        });
    }
});
