// ============================================
// POINTAGE ÉQUIPE — Stockage Local + Sync GitHub
// ============================================

// ============================================
// CONFIGURATION
// ============================================
const ADMIN_PASSWORD = "choco2026";
const ACCESS_PASSWORD = "pots2026";
const GITHUB_REPO = "KalMydasSHARE/pointage";
const CONTRACT_BASE_HOURS = 182;

function getGitHubToken() {
    return localStorage.getItem('pointage_github_token') || '';
}
function setGitHubToken(token) {
    localStorage.setItem('pointage_github_token', token);
}

// ============================================
// STOCKAGE LOCAL
// ============================================
const Storage = {
    // ── Employés ──
    getEmployees() {
        return JSON.parse(localStorage.getItem('pointage_employees') || '[]');
    },
    saveEmployees(employees) {
        localStorage.setItem('pointage_employees', JSON.stringify(employees));
        GitSync.push();
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
    addTimbre(employeeId, employeeName, type, date, time, source, remark) {
        source = source || 'system';
        remark = remark || '';
        if (source === 'admin_manual' && !remark) remark = 'Ajout manuel (admin)';

        const timbrages = this.getTimbrages();
        const id = 't_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        const timestamp = date + 'T' + time + ':00';
        timbrages.push({ id, employeeId, employeeName, type, date, time, timestamp, source, remark });
        localStorage.setItem('pointage_timbrages', JSON.stringify(timbrages));
        GitSync.push();
        return { id, employeeId, employeeName, type, date, time, timestamp, source, remark };
    },
    editTimbre(id, updates) {
        const timbrages = this.getTimbrages();
        const idx = timbrages.findIndex(t => t.id === id);
        if (idx < 0) return null;

        const old = { ...timbrages[idx] };
        const changes = [];

        if (updates.time && updates.time !== old.time) {
            changes.push('heure: ' + old.time + ' → ' + updates.time);
            timbrages[idx].time = updates.time;
            timbrages[idx].timestamp = timbrages[idx].date + 'T' + updates.time + ':00';
        }
        if (updates.type && updates.type !== old.type) {
            changes.push('type: ' + old.type + ' → ' + updates.type);
            timbrages[idx].type = updates.type;
        }
        if (updates.date && updates.date !== old.date) {
            changes.push('date: ' + old.date + ' → ' + updates.date);
            timbrages[idx].date = updates.date;
            timbrages[idx].timestamp = updates.date + 'T' + timbrages[idx].time + ':00';
        }

        const autoRemark = 'Modifié: ' + changes.join(', ');
        timbrages[idx].source = 'admin_edit';
        timbrages[idx].remark = updates.remark
            ? updates.remark + ' (' + autoRemark + ')'
            : autoRemark;
        timbrages[idx].editedAt = new Date().toISOString();

        localStorage.setItem('pointage_timbrages', JSON.stringify(timbrages));
        GitSync.push();
        return timbrages[idx];
    },
    deleteTimbre(id) {
        const timbrages = this.getTimbrages().filter(t => t.id !== id);
        localStorage.setItem('pointage_timbrages', JSON.stringify(timbrages));
        GitSync.push();
    },
    getLastTimbre(employeeId) {
        return this.getTimbrages()
            .filter(t => t.employeeId === employeeId)
            .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0] || null;
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

    // ── Taux fixe par employé ──
    getRates() {
        return JSON.parse(localStorage.getItem('pointage_rates') || '{}');
    },
    saveRates(rates) {
        localStorage.setItem('pointage_rates', JSON.stringify(rates));
        GitSync.push();
    },
    setRate(employeeId, percentage) {
        const rates = this.getRates();
        rates[employeeId] = percentage;
        localStorage.setItem('pointage_rates', JSON.stringify(rates));
        GitSync.push();
    },
    getRate(employeeId) {
        const rates = this.getRates();
        return rates[employeeId] !== undefined ? rates[employeeId] : 100;
    },
    // Backward compat: getContract falls back to fixed rate
    getContract(employeeId, yearMonth) {
        return this.getRate(employeeId);
    },

    // ── Jours fériés (avec heures par employé) ──
    getHolidays() {
        return JSON.parse(localStorage.getItem('pointage_holidays') || '[]');
    },
    saveHolidays(holidays) {
        localStorage.setItem('pointage_holidays', JSON.stringify(holidays));
        GitSync.push();
    },
    addHoliday(date, name) {
        const holidays = this.getHolidays();
        if (holidays.some(h => h.date === date)) return false;
        holidays.push({ date, name, employeeHours: {} });
        holidays.sort((a, b) => a.date.localeCompare(b.date));
        localStorage.setItem('pointage_holidays', JSON.stringify(holidays));
        GitSync.push();
        return true;
    },
    removeHoliday(date) {
        const holidays = this.getHolidays().filter(h => h.date !== date);
        localStorage.setItem('pointage_holidays', JSON.stringify(holidays));
        GitSync.push();
    },
    setHolidayHours(date, employeeId, hours) {
        const holidays = this.getHolidays();
        const h = holidays.find(x => x.date === date);
        if (!h) return;
        if (!h.employeeHours) h.employeeHours = {};
        h.employeeHours[employeeId] = hours;
        localStorage.setItem('pointage_holidays', JSON.stringify(holidays));
        GitSync.push();
    },
    getHolidayHoursForEmployee(date, employeeId) {
        const h = this.getHolidays().find(x => x.date === date);
        if (!h || !h.employeeHours) return 0;
        return h.employeeHours[employeeId] || 0;
    },
    isHoliday(dateStr) {
        return this.getHolidays().some(h => h.date === dateStr);
    },

    // ── Export / Import ──
    exportAll() {
        return JSON.stringify({
            employees: this.getEmployees(),
            timbrages: this.getTimbrages(),
            rates: this.getRates(),
            holidays: this.getHolidays(),
            exportDate: new Date().toISOString()
        }, null, 2);
    },
    importAll(jsonString) {
        const data = JSON.parse(jsonString);
        if (data.employees) localStorage.setItem('pointage_employees', JSON.stringify(data.employees));
        if (data.timbrages) localStorage.setItem('pointage_timbrages', JSON.stringify(data.timbrages));
        if (data.rates) localStorage.setItem('pointage_rates', JSON.stringify(data.rates));
        if (data.holidays) localStorage.setItem('pointage_holidays', JSON.stringify(data.holidays));
        // Backward compat: migrate old contracts to rates
        if (data.contracts && !data.rates) {
            const rates = {};
            data.contracts.forEach(c => { if (!rates[c.employeeId]) rates[c.employeeId] = c.percentage; });
            localStorage.setItem('pointage_rates', JSON.stringify(rates));
        }
    }
};

// ============================================
// GITHUB SYNC
// ============================================
const GitSync = {
    _pushing: false, _pendingPush: false, _sha: null,
    isConfigured() { return getGitHubToken() !== '' && GITHUB_REPO !== ''; },

    async push() {
        if (!this.isConfigured()) return;
        if (this._pushing) { this._pendingPush = true; return; }
        this._pushing = true;
        this._updateIndicator('syncing');
        try {
            const content = btoa(unescape(encodeURIComponent(Storage.exportAll())));
            const body = { message: 'Sync pointage ' + new Date().toLocaleString('fr-CA'), content };
            if (this._sha) body.sha = this._sha;
            const response = await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/data.json', {
                method: 'PUT',
                headers: { 'Authorization': 'Bearer ' + getGitHubToken(), 'Content-Type': 'application/json', 'Accept': 'application/vnd.github.v3+json' },
                body: JSON.stringify(body)
            });
            if (response.ok) {
                this._sha = (await response.json()).content.sha;
                this._updateIndicator('ok');
                console.log('GitHub sync OK');
            } else {
                const err = await response.json();
                if (response.status === 409 || response.status === 422) { await this.pull(); this._pushing = false; return this.push(); }
                this._updateIndicator('error');
            }
        } catch (err) { this._updateIndicator('error'); }
        this._pushing = false;
        if (this._pendingPush) { this._pendingPush = false; this.push(); }
    },

    async pull() {
        if (!this.isConfigured()) return false;
        this._updateIndicator('syncing');
        try {
            const response = await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/data.json', {
                headers: { 'Authorization': 'Bearer ' + getGitHubToken(), 'Accept': 'application/vnd.github.v3+json' }
            });
            if (response.ok) {
                const result = await response.json();
                this._sha = result.sha;
                const content = decodeURIComponent(escape(atob(result.content)));
                const data = JSON.parse(content);
                if ((data.timbrages || []).length > Storage.getTimbrages().length) {
                    Storage.importAll(content);
                    this._updateIndicator('ok');
                    console.log('GitHub pull: données mises à jour');
                    return true;
                }
                this._updateIndicator('ok');
                console.log('GitHub pull: données locales à jour');
                return false;
            } else if (response.status === 404) { this._sha = null; this._updateIndicator('ok'); return false; }
            else { this._updateIndicator('error'); return false; }
        } catch (err) { this._updateIndicator('error'); return false; }
    },

    _updateIndicator(status) {
        const el = document.getElementById('syncIndicator');
        if (!el) return;
        if (status === 'syncing') { el.textContent = 'Synchronisation...'; el.className = 'sync-indicator syncing'; }
        else if (status === 'ok') { el.textContent = 'Sauvegardé'; el.className = 'sync-indicator ok'; setTimeout(() => { el.className = 'sync-indicator hidden'; }, 3000); }
        else { el.textContent = 'Erreur sync'; el.className = 'sync-indicator error'; }
    },

    async init() {
        if (!this.isConfigured()) return false;
        console.log('GitHub sync activé — repo:', GITHUB_REPO);
        return await this.pull();
    }
};

// ============================================
// UTILITAIRES
// ============================================
function todayStr() {
    const n = new Date();
    return n.getFullYear() + '-' + String(n.getMonth()+1).padStart(2,'0') + '-' + String(n.getDate()).padStart(2,'0');
}
function nowTimeStr() {
    const n = new Date();
    return String(n.getHours()).padStart(2,'0') + ':' + String(n.getMinutes()).padStart(2,'0');
}
function currentMonthStr() {
    const n = new Date();
    return n.getFullYear() + '-' + String(n.getMonth()+1).padStart(2,'0');
}
function calculateHours(entryTime, exitTime, date) {
    if (!entryTime || !exitTime) return 0;
    return Math.max(0, (new Date(date+'T'+exitTime+':00') - new Date(date+'T'+entryTime+':00')) / 3600000);
}
function formatHours(hours) {
    if (!hours || hours <= 0) return '0h 00min';
    const h = Math.floor(hours); const m = Math.round((hours - h) * 60);
    return h + 'h ' + String(m).padStart(2,'0') + 'min';
}
function formatDateDisplay(dateStr) {
    const days = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
    const p = dateStr.split('-');
    const d = new Date(parseInt(p[0]), parseInt(p[1])-1, parseInt(p[2]));
    return days[d.getDay()] + ' ' + p[2] + '/' + p[1];
}
function monthNameFr(yearMonth) {
    const mois = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const p = yearMonth.split('-');
    return mois[parseInt(p[1])-1] + ' ' + p[0];
}
function formatBalance(balance) {
    const h = Math.floor(Math.abs(balance)); const m = Math.round((Math.abs(balance)-h)*60);
    return (balance >= 0 ? '+' : '-') + h + 'h ' + String(m).padStart(2,'0') + 'min';
}

// ============================================
// JOURS OUVRÉS
// ============================================
function isWeekend(dateStr) {
    const p = dateStr.split('-');
    const day = new Date(parseInt(p[0]), parseInt(p[1])-1, parseInt(p[2])).getDay();
    return day === 0 || day === 6;
}
function isWorkingDay(dateStr) { return !isWeekend(dateStr) && !Storage.isHoliday(dateStr); }
function getDaysInMonth(yearMonth) {
    const p = yearMonth.split('-');
    return new Date(parseInt(p[0]), parseInt(p[1]), 0).getDate();
}
function getWorkingDaysInMonth(yearMonth) {
    const total = getDaysInMonth(yearMonth); let count = 0;
    for (let d = 1; d <= total; d++) { if (isWorkingDay(yearMonth + '-' + String(d).padStart(2,'0'))) count++; }
    return count;
}
function getWorkingDaysElapsed(yearMonth) {
    const p = yearMonth.split('-');
    const year = parseInt(p[0]), month = parseInt(p[1]);
    const now = new Date();
    let lastDay;
    if (year === now.getFullYear() && month === now.getMonth()+1) lastDay = now.getDate();
    else if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth()+1)) lastDay = getDaysInMonth(yearMonth);
    else return 0;
    let count = 0;
    for (let d = 1; d <= lastDay; d++) { if (isWorkingDay(yearMonth + '-' + String(d).padStart(2,'0'))) count++; }
    return count;
}

// ============================================
// CALCUL HEURES / BALANCE
// ============================================
function getTargetHours(employeeId, yearMonth) {
    return CONTRACT_BASE_HOURS * (Storage.getRate(employeeId) / 100);
}
function getProratedTarget(employeeId, yearMonth) {
    const total = getWorkingDaysInMonth(yearMonth);
    if (total === 0) return 0;
    return getTargetHours(employeeId, yearMonth) * (getWorkingDaysElapsed(yearMonth) / total);
}
function getDailyTarget(employeeId, yearMonth) {
    const wd = getWorkingDaysInMonth(yearMonth);
    return wd > 0 ? getTargetHours(employeeId, yearMonth) / wd : 0;
}

function getWorkedHoursForMonth(employeeId, yearMonth) {
    const timbrages = Storage.getTimbragesByMonth(yearMonth).filter(t => t.employeeId === employeeId);
    const byDate = {};
    timbrages.forEach(t => { if (!byDate[t.date]) byDate[t.date] = []; byDate[t.date].push(t); });
    let total = 0;
    Object.keys(byDate).forEach(date => {
        let entry = null;
        byDate[date].forEach(t => {
            if (t.type === 'ENTRÉE') entry = t;
            else if (t.type === 'SORTIE' && entry) { total += calculateHours(entry.time, t.time, date); entry = null; }
        });
    });
    return total;
}
function getWorkedHoursForDay(employeeId, dateStr) {
    const timbrages = Storage.getTimbragesByEmpAndDate(employeeId, dateStr);
    let total = 0, entry = null;
    timbrages.forEach(t => {
        if (t.type === 'ENTRÉE') entry = t;
        else if (t.type === 'SORTIE' && entry) { total += calculateHours(entry.time, t.time, dateStr); entry = null; }
    });
    if (entry && dateStr === todayStr()) total += calculateHours(entry.time, nowTimeStr(), dateStr);
    return total;
}

// Heures fériées créditées pour un employé dans un mois
function getHolidayHoursForMonth(employeeId, yearMonth) {
    const holidays = Storage.getHolidays().filter(h => h.date.startsWith(yearMonth));
    let total = 0;
    holidays.forEach(h => {
        total += (h.employeeHours && h.employeeHours[employeeId]) || 0;
    });
    return total;
}

// Info complète pour vue employé (friendly, balance jour par jour depuis zéro)
function getEmployeeMonthInfo(employeeId) {
    const ym = currentMonthStr();
    const pct = Storage.getRate(employeeId);
    const monthTarget = getTargetHours(employeeId, ym);
    const worked = getWorkedHoursForMonth(employeeId, ym);
    const holidayHours = getHolidayHoursForMonth(employeeId, ym);
    const totalCredit = worked + holidayHours;
    const remaining = Math.max(0, monthTarget - totalCredit);
    const proratedTarget = getProratedTarget(employeeId, ym);
    const proratedBalance = totalCredit - proratedTarget;
    const workedToday = getWorkedHoursForDay(employeeId, todayStr());
    const dailyTarget = getDailyTarget(employeeId, ym);
    const progressPct = monthTarget > 0 ? Math.min(100, Math.round((totalCredit / monthTarget) * 100)) : 0;
    return { ym, pct, monthTarget, worked, holidayHours, totalCredit, remaining, proratedTarget, proratedBalance, workedToday, dailyTarget, progressPct,
             totalWorkDays: getWorkingDaysInMonth(ym), elapsedWorkDays: getWorkingDaysElapsed(ym) };
}

// Balance annuelle jour par jour (pas de gros négatif au départ)
function getYearBalance(employeeId, year) {
    let cum = 0; const details = [];
    const now = new Date();
    for (let m = 1; m <= 12; m++) {
        const ym = year + '-' + String(m).padStart(2,'0');
        // Ne pas calculer les mois futurs
        if (new Date(year, m-1, 1) > now) break;

        const worked = getWorkedHoursForMonth(employeeId, ym);
        const holidayHours = getHolidayHoursForMonth(employeeId, ym);
        const totalCredit = worked + holidayHours;

        // Balance proratisée: seulement les jours ouvrés écoulés comptent
        const proratedTarget = getProratedTarget(employeeId, ym);
        const bal = totalCredit - proratedTarget;

        // Ne montrer que si l'employé a des données OU c'est le mois courant
        const isCurrent = (year === now.getFullYear() && m === now.getMonth()+1);
        if (totalCredit > 0 || isCurrent) {
            cum += bal;
            details.push({
                yearMonth: ym,
                worked: worked,
                holidayHours: holidayHours,
                totalCredit: totalCredit,
                target: proratedTarget,
                fullTarget: getTargetHours(employeeId, ym),
                balance: bal,
                cumBalance: cum,
                elapsedDays: getWorkingDaysElapsed(ym),
                totalDays: getWorkingDaysInMonth(ym)
            });
        }
    }
    return { cumBalance: cum, monthDetails: details };
}

console.log('Pointage chargé');
