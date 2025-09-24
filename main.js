const app = {
            state: {
                currentView: 'dashboard',
                data: {
                    entries: [],
                    expenseCategories: ['Food', 'Transport', 'Bills', 'Entertainment', 'Other'],
                    incomeTypes: ['Basic Salary', 'Service Charge', 'Tip'],
                    settings: { currencySymbol: 'Rs.' }
                },
                editingEntryId: null,
            },

            // Firebase state
            firebase: {
                db: null,
                user: null,
                dataListener: null, // To unsubscribe from the listener later
                saveTimeout: null, // For debouncing saves
            },

            init() {
                // Initialize Firebase first
                this.initFirebase();
                
                this.updateCurrentMonthDisplay();
                this.populateAnalysisSelectors();
                
                // FIX: Corrected 'new new Date()' to 'new Date()'
                const now = new Date();
                now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
                document.getElementById('entry-date').value = now.toISOString().slice(0, 16);
                
                // Render is now called by the Firebase listener once data is loaded
            },

            // --- FIREBASE INTEGRATION ---
            initFirebase() {
                 // SECURITY NOTE: In a real production application, these keys should not be exposed in the client-side code.
                 // Use environment variables and secure backend functions or Firebase App Check to protect your credentials.
                const firebaseConfig = {
                    apiKey: "AIzaSyBT54tGJ81-cORYsF95zIETzviiortovBI",
                    authDomain: "salary-app-18a5a.firebaseapp.com",
                    projectId: "salary-app-18a5a",
                    storageBucket: "salary-app-18a5a.firebasestorage.app",
                    messagingSenderId: "24176664497",
                    appId: "1:24176664497:web:9fa2f7996f3d3ae78aa790",
                    measurementId: "G-S5BBGE4G4T"
                };

                // Initialize Firebase
                firebase.initializeApp(firebaseConfig);
                firebase.analytics(); // Initialize Analytics

                this.firebase.db = firebase.firestore();
                
                // Enable offline persistence
                firebase.firestore().enablePersistence()
                    .catch((err) => {
                        console.error("Firebase offline persistence failed", err);
                    });

                firebase.auth().onAuthStateChanged(user => {
                    if (user) {
                        this.firebase.user = user;
                        this.loadData(); // Load data once user is authenticated
                        document.getElementById('sync-status').textContent = 'Online';
                    } else {
                        firebase.auth().signInAnonymously().catch(error => {
                            console.error("Anonymous sign-in failed", error);
                            this.showToast('Could not connect to the cloud.', 'error');
                        });
                    }
                });
            },

            // --- DATA MANAGEMENT (Refactored for Firebase) ---
            loadData() {
                if (this.firebase.dataListener) this.firebase.dataListener(); // Unsubscribe from previous listener

                const userDocRef = this.firebase.db.collection('users').doc(this.firebase.user.uid);
                
                document.getElementById('sync-status').textContent = 'Syncing...';
                
                this.firebase.dataListener = userDocRef.onSnapshot(doc => {
                    if (doc.exists) {
                        this.state.data = doc.data();
                        // Ensure defaults for backward compatibility
                        if (!this.state.data.entries) {
                            this.state.data.entries = [];
                        }
                        if (!this.state.data.incomeTypes) {
                            this.state.data.incomeTypes = ['Basic Salary', 'Service Charge', 'Tip'];
                        }
                         if (!this.state.data.expenseCategories) {
                            this.state.data.expenseCategories = ['Food', 'Transport', 'Bills', 'Entertainment', 'Other'];
                        }
                        if (!this.state.data.settings) {
                            this.state.data.settings = { currencySymbol: 'Rs.' };
                        }
                    } else {
                        // If no data, initialize with defaults and save
                        this.saveData(); 
                    }
                    this.render(); // Re-render whenever data changes from the cloud
                    this.populateAnalysisSelectors();
                    document.getElementById('sync-status').textContent = 'Synced';
                    setTimeout(() => { document.getElementById('sync-status').textContent = ''; }, 2000);
                }, error => {
                    console.error("Error listening to data:", error);
                    this.showToast('Sync error. Using offline data.', 'error');
                    document.getElementById('sync-status').textContent = 'Offline';
                });
            },

            saveData() {
                if (!this.firebase.user) return; // Don't save if not logged in

                // Debounce saves to prevent rapid writes to Firestore
                clearTimeout(this.firebase.saveTimeout);
                this.firebase.saveTimeout = setTimeout(() => {
                    const userDocRef = this.firebase.db.collection('users').doc(this.firebase.user.uid);
                    userDocRef.set(this.state.data, { merge: true })
                        .catch(error => {
                            console.error("Error saving data:", error);
                            this.showToast('Failed to save changes to the cloud.', 'error');
                        });
                }, 500); // Wait 500ms after the last change to save
            },

            getEntriesForPeriod(month, year) {
                return this.state.data.entries.filter(entry => {
                    const entryDate = new Date(entry.timestamp);
                    return entryDate.getMonth() === month && entryDate.getFullYear() === year;
                });
            },

            // --- UI RENDERING ---
            render() {
                this.updateActiveView();
                this.updateActiveNav();
                
                // Change Starts Here: Manage visibility of Floating Action Buttons
                const fabContainer = document.getElementById('fab-container');
                if (fabContainer) {
                    if (this.state.currentView === 'dashboard') {
                        fabContainer.style.display = 'flex';
                    } else {
                        fabContainer.style.display = 'none';
                    }
                }
                // Change Ends Here
                
                const now = new Date();
                const currentMonthEntries = this.getEntriesForPeriod(now.getMonth(), now.getFullYear());

                this.renderDashboard(currentMonthEntries);
                this.renderIncomesView(currentMonthEntries);
                this.renderExpensesView(currentMonthEntries);
                this.renderSettingsView();
            },
            
            renderDashboard(entries) {
                const { totalIncome, totalExpenses } = this.calculateTotals(entries);
                const currency = this.state.data.settings.currencySymbol;
                
                document.getElementById('net-balance-dashboard').textContent = `${currency} ${(totalIncome - totalExpenses).toFixed(2)}`;
                document.getElementById('total-income-dashboard').textContent = `${currency} ${totalIncome.toFixed(2)}`;
                document.getElementById('total-expenses-dashboard').textContent = `${currency} ${totalExpenses.toFixed(2)}`;
            },

            renderIncomesView(entries) {
                 const { totalIncome } = this.calculateTotals(entries);
                 const currency = this.state.data.settings.currencySymbol;
                 document.getElementById('total-income-view').textContent = `${currency} ${totalIncome.toFixed(2)}`;
                 
                 const container = document.getElementById('income-sections-container');
                 container.innerHTML = '';
                 
                 this.state.data.incomeTypes.forEach(type => {
                     const typeEntries = entries.filter(e => e.type === 'income' && e.category === type);
                     const typeTotal = typeEntries.reduce((sum, e) => sum + e.amount, 0);

                     const section = document.createElement('div');
                     section.className = 'glass-card p-4 mb-4';
                     section.innerHTML = `
                        <div id="income-type-header-${type.replace(/\s+/g, '-')}" class="flex justify-between items-center mb-2">
                            <h3 class="font-semibold text-lg">${type}</h3>
                            <div class="flex items-center gap-3">
                                <span class="font-bold text-green-400">${currency} ${typeTotal.toFixed(2)}</span>
                                <button onclick="app.showEditIncomeTypeInput('${type}')" class="text-blue-400 text-xs">Edit</button>
                                <button onclick="app.deleteIncomeType('${type}')" class="text-red-400 text-xs">Del</button>
                            </div>
                        </div>
                        <ul class="space-y-2 text-sm">
                            ${typeEntries.map(e => this.createEntryListItem(e)).join('')}
                        </ul>
                     `;
                     container.appendChild(section);
                 });
            },
            
            renderExpensesView(entries) {
                const { totalExpenses } = this.calculateTotals(entries);
                const currency = this.state.data.settings.currencySymbol;
                document.getElementById('total-expenses-view').textContent = `${currency} ${totalExpenses.toFixed(2)}`;
                
                const container = document.getElementById('expense-list-container');
                container.innerHTML = '';

                this.state.data.expenseCategories.forEach(category => {
                    const categoryEntries = entries.filter(e => e.type === 'expense' && e.category === category);
                    const categoryTotal = categoryEntries.reduce((sum, e) => sum + e.amount, 0);
                    
                    const section = document.createElement('div');
                    section.className = 'glass-card p-4 mb-4';
                    section.innerHTML = `
                        <div id="expense-category-header-${category.replace(/\s+/g, '-')}" class="flex justify-between items-center mb-2">
                            <h3 class="font-semibold text-lg">${category}</h3>
                            <div class="flex items-center gap-3">
                                <span class="font-bold text-red-400">${currency} ${categoryTotal.toFixed(2)}</span>
                                <button onclick="app.showEditExpenseCategoryInput('${category}')" class="text-blue-400 text-xs">Edit</button>
                                <button onclick="app.deleteExpenseCategory('${category}')" class="text-red-400 text-xs">Del</button>
                            </div>
                        </div>
                        <ul class="space-y-2 text-sm">
                            ${categoryEntries.map(e => this.createEntryListItem(e)).join('')}
                        </ul>
                    `;
                    container.appendChild(section);
                });
            },
            
            renderAnalysis() {
                const month = parseInt(document.getElementById('analysis-month').value);
                const year = parseInt(document.getElementById('analysis-year').value);
                
                const entries = this.getEntriesForPeriod(month, year);
                const { totalIncome, totalExpenses } = this.calculateTotals(entries);
                const currency = this.state.data.settings.currencySymbol;
                
                const container = document.getElementById('analysis-results-container');
                
                if (entries.length === 0) {
                    container.innerHTML = `<div class="glass-card p-4 text-center text-gray-400">No data for the selected period.</div>`;
                    return;
                }
                
                const incomeByCategory = this.groupAndSum(entries.filter(e => e.type === 'income'), 'category');
                const expenseByCategory = this.groupAndSum(entries.filter(e => e.type === 'expense'), 'category');

                container.innerHTML = `
                    <div class="glass-card p-4">
                        <h3 class="font-bold text-xl mb-2">Summary for ${new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
                        <div class="grid grid-cols-2 gap-4 text-center">
                            <div><p class="text-green-400">Total Income</p><p class="text-2xl">${currency} ${totalIncome.toFixed(2)}</p></div>
                            <div><p class="text-red-400">Total Expenses</p><p class="text-2xl">${currency} ${totalExpenses.toFixed(2)}</p></div>
                        </div>
                        <div class="mt-4 text-center"><p class="text-gray-400">Net Balance</p><p class="text-3xl font-bold">${currency} ${(totalIncome - totalExpenses).toFixed(2)}</p></div>
                    </div>
                    
                    <div class="glass-card p-4">
                        <div id="income-chart-container"></div>
                    </div>

                    <div class="glass-card p-4">
                        <div id="expense-chart-container"></div>
                    </div>
                `;
                
                this.renderBarChart(
                    document.getElementById('income-chart-container'), 
                    'Income Breakdown', incomeByCategory, currency, 'bg-green-500'
                );
                this.renderBarChart(
                    document.getElementById('expense-chart-container'), 
                    'Expense Breakdown', expenseByCategory, currency, 'bg-red-500'
                );
            },
            
            renderBarChart(container, title, data, currency, barColorClass) {
                if (Object.keys(data).length === 0) {
                    container.innerHTML = `<h4 class="font-semibold mb-2">${title}</h4><p class="text-sm text-gray-400">No data available.</p>`;
                    return;
                }
                const total = Object.values(data).reduce((sum, v) => sum + v, 0);
                const itemsHtml = Object.entries(data).sort(([,a],[,b]) => b-a).map(([label, value]) => {
                    const percentage = total > 0 ? (value / total) * 100 : 0;
                    return `
                        <div class="mb-2">
                            <div class="flex justify-between text-sm mb-1">
                                <span class="text-gray-300">${label}</span>
                                <span>${currency} ${value.toFixed(2)}</span>
                            </div>
                            <div class="w-full bg-gray-700 rounded-full h-2.5">
                                <div class="${barColorClass} h-2.5 rounded-full" style="width: ${percentage}%"></div>
                            </div>
                        </div>
                    `;
                }).join('');
                container.innerHTML = `<h4 class="font-semibold mb-3">${title}</h4>${itemsHtml}`;
            },

            renderSettingsView() {
                document.getElementById('currency-symbol').value = this.state.data.settings.currencySymbol;
            },

            // --- UI HELPERS & NAVIGATION ---
            changeView(viewName) {
                this.state.currentView = viewName;
                document.getElementById('header-title').textContent = viewName.charAt(0).toUpperCase() + viewName.slice(1);
                this.render();
                if(viewName === 'analysis') this.renderAnalysis();
            },

            updateActiveView() {
                document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
                document.getElementById(`${this.state.currentView}-view`).classList.add('active');
            },

            updateActiveNav() {
                document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
                document.querySelector(`.nav-item[onclick="app.changeView('${this.state.currentView}')"]`).classList.add('active');
            },
            
            updateCurrentMonthDisplay() {
                const now = new Date();
                document.getElementById('current-month-display').textContent = now.toLocaleString('default', { month: 'long', year: 'numeric' });
            },
            
            createEntryListItem(entry) {
                const currency = this.state.data.settings.currencySymbol;
                const entryDate = new Date(entry.timestamp);
                // Added an ID to the <li> for animation targeting
                return `
                    <li id="entry-item-${entry.id}" class="flex justify-between items-center bg-black bg-opacity-20 p-2 rounded-md">
                        <div>
                            <span class="font-medium">${currency} ${entry.amount.toFixed(2)}</span>
                            <span class="text-gray-400 ml-2 text-xs">${entryDate.toLocaleDateString()} ${entryDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <div class="flex gap-2">
                           <button onclick="app.showEditModal('${entry.id}')" class="text-blue-400 text-xs">Edit</button>
                           <button onclick="app.deleteEntry('${entry.id}')" class="text-red-400 text-xs">Delete</button>
                        </div>
                    </li>
                `;
            },

            // --- MODAL & FORM HANDLING ---
            showAddModal(type) {
                this.state.editingEntryId = null;
                document.getElementById('modal-form').reset();
                
                const now = new Date();
                now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
                document.getElementById('entry-date').value = now.toISOString().slice(0,16);

                document.getElementById('modal-title').textContent = `Add New ${type.charAt(0).toUpperCase() + type.slice(1)}`;
                document.getElementById('entry-type').value = type;
                
                this.toggleCategorySelectors(type);
                this.showModal();
            },

            showEditModal(entryId) {
                this.state.editingEntryId = entryId;
                const entry = this.state.data.entries.find(e => e.id === entryId);
                if (!entry) return;

                document.getElementById('modal-title').textContent = `Edit ${entry.type.charAt(0).toUpperCase() + entry.type.slice(1)}`;
                document.getElementById('entry-id').value = entry.id;
                document.getElementById('entry-type').value = entry.type;
                document.getElementById('entry-amount').value = entry.amount;
                
                const entryDate = new Date(entry.timestamp);
                entryDate.setMinutes(entryDate.getMinutes() - entryDate.getTimezoneOffset());
                document.getElementById('entry-date').value = entryDate.toISOString().slice(0, 16);
                
                this.toggleCategorySelectors(entry.type);
                
                if(entry.type === 'income') {
                    document.getElementById('income-category').value = entry.category;
                } else {
                    document.getElementById('expense-category').value = entry.category;
                }

                this.showModal();
            },
            
            showModal() { document.getElementById('modal').style.display = 'flex'; },
            hideModal() { document.getElementById('modal').style.display = 'none'; },

            handleFormSubmit() {
                const id = this.state.editingEntryId || `entry-${Date.now()}`;
                const type = document.getElementById('entry-type').value;
                const amount = parseFloat(document.getElementById('entry-amount').value);
                const dateValue = document.getElementById('entry-date').value;
                const timestamp = new Date(dateValue).getTime();

                let category = '';
                if (type === 'income') {
                    category = document.getElementById('income-category').value;
                } else {
                    category = document.getElementById('expense-category').value;
                }

                if (isNaN(amount) || amount <= 0 || !category || !timestamp) {
                    this.showToast('Please fill all fields correctly.', 'error');
                    return;
                }
                
                const newEntry = { id, type, amount, category, timestamp };

                if (this.state.editingEntryId) {
                    const index = this.state.data.entries.findIndex(e => e.id === this.state.editingEntryId);
                    this.state.data.entries[index] = newEntry;
                } else {
                    this.state.data.entries.push(newEntry);
                }

                this.saveData();
                this.hideModal();
            },
            
            toggleCategorySelectors(type) {
                const incomeSelector = document.getElementById('income-type-selector');
                const expenseSelector = document.getElementById('expense-category-selector');
                
                if (type === 'income') {
                    incomeSelector.style.display = 'block';
                    expenseSelector.style.display = 'none';
                    const incomeCatSelect = document.getElementById('income-category');
                    incomeCatSelect.innerHTML = this.state.data.incomeTypes
                        .map(cat => `<option value="${cat}">${cat}</option>`).join('');
                } else {
                    incomeSelector.style.display = 'none';
                    expenseSelector.style.display = 'block';
                    const expenseCatSelect = document.getElementById('expense-category');
                    expenseCatSelect.innerHTML = this.state.data.expenseCategories
                        .map(cat => `<option value="${cat}">${cat}</option>`).join('');
                }
            },
            
            deleteEntry(entryId) {
                if (confirm('Are you sure you want to delete this entry?')) {
                    // Animation on delete
                    const itemElement = document.getElementById(`entry-item-${entryId}`);
                    if (itemElement) {
                        itemElement.classList.add('list-item-exit');
                        // Wait for animation to finish before removing data
                        setTimeout(() => {
                            this.state.data.entries = this.state.data.entries.filter(e => e.id !== entryId);
                            this.saveData();
                        }, 300);
                    } else {
                        // Fallback if element not found
                        this.state.data.entries = this.state.data.entries.filter(e => e.id !== entryId);
                        this.saveData();
                    }
                }
            },
            
            // --- CATEGORY MANAGEMENT ---
            addExpenseCategory() {
                const input = document.getElementById('new-expense-category-input');
                const newCategory = input.value.trim();
                if (newCategory && !this.state.data.expenseCategories.includes(newCategory)) {
                    this.state.data.expenseCategories.push(newCategory);
                    this.saveData();
                    input.value = '';
                } else if (!newCategory) {
                    this.showToast('Category name cannot be empty.', 'error');
                } else {
                    this.showToast('This category already exists.', 'error');
                }
            },
            
            showEditExpenseCategoryInput(oldCategory) {
                const headerDiv = document.getElementById(`expense-category-header-${oldCategory.replace(/\s+/g, '-')}`);
                headerDiv.innerHTML = `
                    <input type="text" class="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-lg flex-grow" value="${oldCategory}">
                    <div class="flex gap-2">
                        <button onclick="app.saveExpenseCategoryEdit('${oldCategory}', this)" class="text-green-400 text-sm">Save</button>
                        <button onclick="app.render()" class="text-gray-400 text-sm">Cancel</button>
                    </div>`;
                headerDiv.querySelector('input').focus();
            },

            saveExpenseCategoryEdit(oldCategory, buttonElement) {
                const input = buttonElement.parentElement.previousElementSibling;
                const newCategory = input.value.trim();

                if (!newCategory || newCategory === oldCategory) {
                    this.render(); return;
                }
                if (this.state.data.expenseCategories.includes(newCategory)) {
                    this.showToast('A category with this name already exists.', 'error'); return;
                }

                // Update category list
                const catIndex = this.state.data.expenseCategories.indexOf(oldCategory);
                if (catIndex > -1) this.state.data.expenseCategories[catIndex] = newCategory;

                // Update all associated entries
                this.state.data.entries.forEach(entry => {
                    if (entry.type === 'expense' && entry.category === oldCategory) {
                        entry.category = newCategory;
                    }
                });

                this.saveData();
            },

            deleteExpenseCategory(category) {
                const isUsed = this.state.data.entries.some(e => e.type === 'expense' && e.category === category);
                if (isUsed) {
                    this.showToast('Cannot delete category with associated entries.', 'error');
                    return;
                }
                if (confirm(`Are you sure you want to delete the category "${category}"?`)) {
                    this.state.data.expenseCategories = this.state.data.expenseCategories.filter(c => c !== category);
                    this.saveData();
                }
            },

            addIncomeType() {
                const input = document.getElementById('new-income-type-input');
                const newType = input.value.trim();
                if (newType && !this.state.data.incomeTypes.includes(newType)) {
                    this.state.data.incomeTypes.push(newType);
                    this.saveData();
                    input.value = '';
                } else if (!newType) {
                    this.showToast('Income type name cannot be empty.', 'error');
                } else {
                    this.showToast('This income type already exists.', 'error');
                }
            },

            showEditIncomeTypeInput(oldType) {
                const headerDiv = document.getElementById(`income-type-header-${oldType.replace(/\s+/g, '-')}`);
                headerDiv.innerHTML = `
                    <input type="text" class="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-lg flex-grow" value="${oldType}">
                    <div class="flex gap-2">
                        <button onclick="app.saveIncomeTypeEdit('${oldType}', this)" class="text-green-400 text-sm">Save</button>
                        <button onclick="app.render()" class="text-gray-400 text-sm">Cancel</button>
                    </div>`;
                headerDiv.querySelector('input').focus();
            },

            saveIncomeTypeEdit(oldType, buttonElement) {
                const input = buttonElement.parentElement.previousElementSibling;
                const newType = input.value.trim();
                
                if (!newType || newType === oldType) {
                    this.render(); return;
                }
                if (this.state.data.incomeTypes.includes(newType)) {
                    this.showToast('An income type with this name already exists.', 'error'); return;
                }
                
                const typeIndex = this.state.data.incomeTypes.indexOf(oldType);
                if (typeIndex > -1) this.state.data.incomeTypes[typeIndex] = newType;

                this.state.data.entries.forEach(entry => {
                    if (entry.type === 'income' && entry.category === oldType) {
                        entry.category = newType;
                    }
                });

                this.saveData();
            },

            deleteIncomeType(type) {
                const isUsed = this.state.data.entries.some(e => e.type === 'income' && e.category === type);
                if (isUsed) {
                    this.showToast('Cannot delete income type with associated entries.', 'error');
                    return;
                }
                if (confirm(`Are you sure you want to delete the income type "${type}"?`)) {
                    this.state.data.incomeTypes = this.state.data.incomeTypes.filter(t => t !== type);
                    this.saveData();
                }
            },
            
            // --- SETTINGS & BACKUP ---
            saveSettings() {
                this.state.data.settings.currencySymbol = document.getElementById('currency-symbol').value;
                this.saveData();
                this.render(); // Render immediately for visual feedback
                this.showToast('Settings saved!', 'success');
            },
            
            resetAllData() {
                if(confirm('WARNING: This will delete all your cloud data permanently. Are you sure?')) {
                    // Reset to default state
                    this.state.data = {
                        entries: [],
                        expenseCategories: ['Food', 'Transport', 'Bills', 'Entertainment', 'Other'],
                        incomeTypes: ['Basic Salary', 'Service Charge', 'Tip'],
                        settings: { currencySymbol: 'Rs.' }
                    };
                    // Overwrite cloud data with the empty default state
                    this.saveData();
                }
            },

            populateAnalysisSelectors() {
                const monthSelect = document.getElementById('analysis-month');
                const yearSelect = document.getElementById('analysis-year');
                const now = new Date();

                monthSelect.innerHTML = [...Array(12).keys()].map(i => {
                    const monthName = new Date(0, i).toLocaleString('default', { month: 'long' });
                    return `<option value="${i}" ${i === now.getMonth() ? 'selected' : ''}>${monthName}</option>`;
                }).join('');

                const years = [...new Set(this.state.data.entries.map(e => new Date(e.timestamp).getFullYear()))];
                if (!years.includes(now.getFullYear())) years.push(now.getFullYear());
                years.sort((a,b) => b-a);
                
                yearSelect.innerHTML = years.map(y => `<option value="${y}" ${y === now.getFullYear() ? 'selected' : ''}>${y}</option>`).join('');
            },

            // --- CALCULATION & UTILITY ---
            calculateTotals(entries) {
                const totalIncome = entries
                    .filter(e => e.type === 'income')
                    .reduce((sum, e) => sum + e.amount, 0);

                const totalExpenses = entries
                    .filter(e => e.type === 'expense')
                    .reduce((sum, e) => sum + e.amount, 0);
                
                return { totalIncome, totalExpenses };
            },
            
            groupAndSum(entries, key) {
                return entries.reduce((acc, entry) => {
                    acc[entry[key]] = (acc[entry[key]] || 0) + entry.amount;
                    return acc;
                }, {});
            },

            // --- Toast Notification System ---
            showToast(message, type = 'info') {
                const container = document.getElementById('toast-container');
                const toast = document.createElement('div');
                toast.className = `toast ${type}`;
                toast.textContent = message;
                
                container.appendChild(toast);
                
                setTimeout(() => {
                    toast.remove();
                }, 3000); // Toast disappears after 3 seconds
            },
        };

        document.addEventListener('DOMContentLoaded', () => {
            app.init();
        });

        window.app = app;
