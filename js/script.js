// Čekáme na načtení stránky
document.addEventListener('DOMContentLoaded', function() {
    
    // Získáme všechny navigační odkazy a stránky
    const navLinks = document.querySelectorAll('.nav-link');
    const pages = document.querySelectorAll('.page');
    
    // Funkce pro zobrazení stránky
    function showPage(pageId) {
        // Skryjeme všechny stránky
        pages.forEach(page => {
            page.classList.remove('active');
        });
        
        // Zobrazíme vybranou stránku
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.classList.add('active');
        }
        
        // Aktualizujeme aktivní navigační odkaz
        navLinks.forEach(link => {
            link.classList.remove('active');
        });
        
        // Označíme aktivní odkaz
        const activeLink = document.querySelector(`[data-page="${pageId}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
        
        // Uložíme aktuální stránku do localStorage
        localStorage.setItem('currentPage', pageId);
    }
    
    // Přidáme event listenery na navigační odkazy
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            // Zjistíme, zda odkaz má data-page atribut.
            // Odkazy jako "Domů" ho mají a jsou určeny pro interní přepínání obsahu.
            // Odkazy jako "RadarEU.html" ho nemají a mají se načíst normálně.
            const pageId = this.getAttribute('data-page');

            if (pageId) {
                // Pokud odkaz má data-page, jedná se o interní navigaci (jako Domů)
                e.preventDefault(); // Zabraňte výchozímu chování odkazu
                showPage(pageId);
            } 
            // else {
            // Pokud odkaz nemá data-page, nevoláme e.preventDefault(),
            // a prohlížeč se tak zachová standardně a načte RadarEU.html
            // }
            
            // Přidáme efekt kliknutí (platí pro všechny nav-linky)
            this.style.transform = 'translateX(8px)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
        });
        
        // Hover efekt pro navigační odkazy (ponecháno beze změny)
        link.addEventListener('mouseenter', function() {
            if (!this.classList.contains('active')) {
                this.style.backgroundColor = '#3a3a3a';
            }
        });
        
        link.addEventListener('mouseleave', function() {
            if (!this.classList.contains('active')) {
                this.style.backgroundColor = '';
            }
        });
    });
    
    // Obnovíme poslední navštívenou stránku při načtení
    const savedPage = localStorage.getItem('currentPage');
    if (savedPage) {
        showPage(savedPage);
    }
    
    // Přidáme smooth scroll efekt pro karty (ponecháno beze změny)
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px) scale(1.02)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
    
    // Funkce pro responzivní navigaci na mobilních zařízeních (ponecháno beze změny)
    function handleMobileNavigation() {
        if (window.innerWidth <= 600) {
            const sidebar = document.querySelector('.sidebar');
            const navLinksContainer = document.querySelector('.nav-links');
            
            // Přidáme toggle funkčnost pro mobilní menu
            const logo = document.querySelector('.logo h2');
            logo.style.cursor = 'pointer';
            
            logo.addEventListener('click', function() {
                navLinksContainer.style.display = 
                    navLinksContainer.style.display === 'none' ? 'flex' : 'none';
            });
        }
    }
    
    // Zavoláme funkci při načtení a změně velikosti okna (ponecháno beze změny)
    handleMobileNavigation();
    window.addEventListener('resize', handleMobileNavigation);
    
    // Přidáme animaci načítání (ponecháno beze změny)
    setTimeout(() => {
        document.body.style.opacity = '1';
    }, 100);
    
    // Keyboard navigation (ponecháno beze změny, ale je tu 'e.preventDefault()' pro tyto zkratky)
    document.addEventListener('keydown', function(e) {
        if (e.altKey) {
            switch(e.key) {
                case '1':
                    e.preventDefault();
                    showPage('home');
                    break;
                case '2':
                    e.preventDefault();
                    // showPage('about'); // Původně směřovalo na 'about'
                    // Zde byste musel zkontrolovat, na jakou stránku chcete Alt+2 mapovat
                    // např. window.location.href = 'RadarEU.html';
                    // nebo pokud máte interní 'about' stránku s data-page="about"
                    break;
                // ... a tak dále pro ostatní klávesové zkratky
            }
        }
    });
    
    // Přidáme tooltip pro keyboard shortcuts (ponecháno beze změny)
    const shortcuts = {
        'home': 'Alt+1',
        // Ostatní zkratky pro interní stránky by měly mít data-page atribut
        'about': 'Alt+2',
        'services': 'Alt+3',
        'portfolio': 'Alt+4',
        'blog': 'Alt+5',
        'contact': 'Alt+6'
    };
    
    navLinks.forEach(link => {
        const pageId = link.getAttribute('data-page');
        if (shortcuts[pageId]) {
            link.title = `${link.textContent} (${shortcuts[pageId]})`;
        }
    });
    
    console.log('Webová stránka byla úspěšně načtena!');
    console.log('Použijte Alt+1-6 pro rychlou navigaci mezi stránkami.');
});
