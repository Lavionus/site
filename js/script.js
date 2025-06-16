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
            e.preventDefault();
            
            const pageId = this.getAttribute('data-page');
            showPage(pageId);
            
            // Přidáme efekt kliknutí
            this.style.transform = 'translateX(8px)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
        });
        
        // Hover efekt pro navigační odkazy
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
    
    // Přidáme smooth scroll efekt pro karty
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px) scale(1.02)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
    
    // Funkce pro responzivní navigaci na mobilních zařízeních
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
    
    // Zavoláme funkci při načtení a změně velikosti okna
    handleMobileNavigation();
    window.addEventListener('resize', handleMobileNavigation);
    
    // Přidáme animaci načítání
    setTimeout(() => {
        document.body.style.opacity = '1';
    }, 100);
    
    // Keyboard navigation
    document.addEventListener('keydown', function(e) {
        if (e.altKey) {
            switch(e.key) {
                case '1':
                    e.preventDefault();
                    showPage('home');
                    break;
                case '2':
                    e.preventDefault();
                    showPage('about');
                    break;
                case '3':
                    e.preventDefault();
                    showPage('services');
                    break;
                case '4':
                    e.preventDefault();
                    showPage('portfolio');
                    break;
                case '5':
                    e.preventDefault();
                    showPage('blog');
                    break;
                case '6':
                    e.preventDefault();
                    showPage('contact');
                    break;
            }
        }
    });
    
    // Přidáme tooltip pro keyboard shortcuts
    const shortcuts = {
        'home': 'Alt+1',
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
