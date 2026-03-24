// ============================================
// POINTAGE ÉQUIPE — Stockage Local + Sync GitHub
// ============================================

// ============================================
// CONFIGURATION
// ============================================
const ADMIN_PASSWORD = "choco2026";
const ACCESS_PASSWORD = "pots2026";  // mot de passe pour accéder au pointage

// GitHub Sync
const GITHUB_REPO = "KalMydasSHARE/pointage";

// Token stocké dans le navigateur (jamais dans le code source)
function getGitHubToken() {
    return localStorage.getItem('pointage_github_token') || '';
}
function setGitHubToken(token) {
    localStorage.setItem('pointage_github_token', token);
}

// ============================================
// STOCKAGE LOCAL (localStorage)
// ============================================
const Storage = {
    getEmployees() {
        return JSON.parse(localStorage.getItem('pointage_employees') || '[]');
    },

    saveEmployees(employees) {
        localStorage.setItem('pointage_employees', JSON.stringify(employees));
        GitSync.push(); // sync auto
    },

    addEmployee(name) {
        const employees = this.getEmployees();
        const id = 'emp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        employees.push({ id, name });
        localStorage.setItem('pointage_employees', JSON.stringify(employees));
        GitSync.push();
        return { id, name };
    },

    deleteEmployee(id) {
        const employees = this.getEmployees().filter(e => e.id !== id);
        localStorage.setItem('pointage_employees', JSON.stringify(employees));
        GitSync.push();
    },

    getEmployeeById(id) {
        return this.getEmployees().find(e => e.id === id) || null;
    },

    // ── Timbrages ──
    getTimbrages() {
        return JSON.parse(localStorage.getItem('pointage_timbrages') || '[]');
    },

    saveTimbrages(timbrages) {
        localStorage.setItem('pointage_timbrages', JSON.stringify(timbrages));
        GitSync.push();
    },

    addTimbre(employeeId, employeeName, type, date, time) {
        const timbrages = this.getTimbrages();
        const id = 't_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        const timestamp = date + 'T' + time + ':00';
        timbrages.push({ id, employeeId, employeeName, type, date, time, timestamp });
        localStorage.setItem('pointage_timbrages', JSON.stringify(timbrages));
        GitSync.push();
        return { id, employeeId, employeeName, type, date, time, timestamp };
    },

    deleteTimbre(id) {
        const timbrages = this.getTimbrages().filter(t => t.id !== id);
        localStorage.setItem('pointage_timbrages', JSON.stringify(timbrages));
        GitSync.push();
    },

    getLastTimbre(employeeId) {
        const timbrages = this.getTimbrages()
            .filter(t => t.employeeId === employeeId)
            .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        return timbrages[0] || null;
    },

    getTimbragesByEmpAndDate(employeeId, date) {
        return this.getTimbrages()
            .filter(t => t.employeeId === employeeId && t.date === date)
            .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    },

    getTimbragesByDate(date) {
        return this.getTimbrages()
            .filter(t => t.date === date)
            .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    },

    getTimbragesByMonth(yearMonth) {
        return this.getTimbrages()
            .filter(t => t.date.startsWith(yearMonth))
            .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    },

    // ── Export / Import ──
    exportAll() {
        return JSON.stringify({
            employees: this.getEmployees(),
            timbrages: this.getTimbrages(),
            exportDate: new Date().toISOString()
        }, null, 2);
    },

    importAll(jsonString) {
        const data = JSON.parse(jsonString);
        if (data.employees) localStorage.setItem('pointage_employees', JSON.stringify(data.employees));
        if (data.timbrages) localStorage.setItem('pointage_timbrages', JSON.stringify(data.timbrages));
    }
};

// ============================================
// GITHUB SYNC
// ============================================
const GitSync = {
    _pushing: false,
    _pendingPush: false,
    _sha: null, // SHA du fichier sur GitHub (nécessaire pour update)

    isConfigured() {
        return getGitHubToken() !== '' && GITHUB_REPO !== '';
    },

    // Envoyer les données vers GitHub
    async push() {
        if (!this.isConfigured()) return;

        // Anti-flood : si un push est déjà en cours, on note qu'il faut en refaire un après
        if (this._pushing) {
            this._pendingPush = true;
            return;
        }

        this._pushing = true;
        this._updateIndicator('syncing');

        try {
            const content = btoa(unescape(encodeURIComponent(Storage.exportAll())));

            const body = {
                message: 'Sync pointage ' + new Date().toLocaleString('fr-CA'),
                content: content
            };

            // Si on connaît le SHA, on fait un update (sinon GitHub refuse)
            if (this._sha) {
                body.sha = this._sha;
            }

            const response = await fetch(
                'https://api.github.com/repos/' + GITHUB_REPO + '/contents/data.json',
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': 'Bearer ' + getGitHubToken(),
                        'Content-Type': 'application/json',
                        'Accept': 'application/vnd.github.v3+json'
                    },
                    body: JSON.stringify(body)
                }
            );

            if (response.ok) {
                const result = await response.json();
                this._sha = result.content.sha;
                this._updateIndicator('ok');
                console.log('GitHub sync OK');
            } else {
                const err = await response.json();
                console.error('GitHub sync erreur:', err.message);

                // Si erreur 409 (conflit SHA), récupérer le bon SHA et réessayer
                if (response.status === 409 || response.status === 422) {
                    await this.pull();
                    this._pushing = false;
                    return this.push();
                }

                this._updateIndicator('error');
            }
        } catch (err) {
            console.error('GitHub sync erreur réseau:', err);
            this._updateIndicator('error');
        }

        this._pushing = false;

        // S'il y avait un push en attente, on le fait maintenant
        if (this._pendingPush) {
            this._pendingPush = false;
            this.push();
        }
    },

    // Récupérer les données depuis GitHub
    async pull() {
        if (!this.isConfigured()) return false;

        this._updateIndicator('syncing');

        try {
            const response = await fetch(
                'https://api.github.com/repos/' + GITHUB_REPO + '/contents/data.json',
                {
                    headers: {
                        'Authorization': 'Bearer ' + getGitHubToken(),
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );

            if (response.ok) {
                const result = await response.json();
                this._sha = result.sha;

                // Décoder le contenu (base64)
                const content = decodeURIComponent(escape(atob(result.content)));
                const data = JSON.parse(content);

                // Comparer : prendre les données qui ont le plus d'entrées
                const localTimbrages = Storage.getTimbrages();
                const remoteTimbrages = data.timbrages || [];

                if (remoteTimbrages.length > localTimbrages.length) {
                    // GitHub a plus de données → restaurer
                    Storage.importAll(content);
                    console.log('GitHub pull: données restaurées depuis GitHub');
                    this._updateIndicator('ok');
                    return true; // données mises à jour
                } else {
                    console.log('GitHub pull: données locales à jour');
                    this._updateIndicator('ok');
                    return false; // pas de changement
                }

            } else if (response.status === 404) {
                // Fichier n'existe pas encore — premier push le créera
                console.log('GitHub: data.json n\'existe pas encore');
                this._sha = null;
                this._updateIndicator('ok');
                return false;
            } else {
                console.error('GitHub pull erreur:', response.status);
                this._updateIndicator('error');
                return false;
            }
        } catch (err) {
            console.error('GitHub pull erreur réseau:', err);
            this._updateIndicator('error');
            return false;
        }
    },

    // Petit indicateur visuel dans la page
    _updateIndicator(status) {
        const el = document.getElementById('syncIndicator');
        if (!el) return;

        if (status === 'syncing') {
            el.textContent = 'Synchronisation...';
            el.className = 'sync-indicator syncing';
        } else if (status === 'ok') {
            el.textContent = 'Sauvegardé';
            el.className = 'sync-indicator ok';
            // Masquer après 3s
            setTimeout(() => { el.className = 'sync-indicator hidden'; }, 3000);
        } else if (status === 'error') {
            el.textContent = 'Erreur sync';
            el.className = 'sync-indicator error';
        }
    },

    // Initialiser : pull au démarrage
    async init() {
        if (!this.isConfigured()) {
            console.log('GitHub sync désactivé (pas configuré)');
            return false;
        }

        console.log('GitHub sync activé — repo:', GITHUB_REPO);
        const updated = await this.pull();
        return updated;
    }
};

// ============================================
// FONCTIONS UTILITAIRES
// ============================================
function todayStr() {
    const now = new Date();
    return now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0');
}

function nowTimeStr() {
    const now = new Date();
    return String(now.getHours()).padStart(2, '0') + ':' +
        String(now.getMinutes()).padStart(2, '0');
}

function currentMonthStr() {
    const now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
}

function calculateHours(entryTime, exitTime, date) {
    if (!entryTime || !exitTime) return 0;
    const entry = new Date(date + 'T' + entryTime + ':00');
    const exit = new Date(date + 'T' + exitTime + ':00');
    const diff = (exit - entry) / 1000 / 60 / 60;
    return Math.max(0, diff);
}

function formatHours(hours) {
    if (!hours || hours <= 0) return '0h 00min';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return h + 'h ' + String(m).padStart(2, '0') + 'min';
}

function formatDateDisplay(dateStr) {
    const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const parts = dateStr.split('-');
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return days[d.getDay()] + ' ' + parts[2] + '/' + parts[1];
}

console.log('Pointage chargé');