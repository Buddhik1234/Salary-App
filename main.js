const app = {
            state: {
                currentView: 'dashboard',
                data: {
                    entries: [],
                    expenseCategories: ['Food', 'Transport', 'Bills', 'Entertainment', 'Other'],
                    incomeTypes: ['Basic Salary', 'Service Charge', 'Tip'],
                    settings: {
                        currencySymbol: 'Rs.'
                    }
                },
                editingEntryId: null,
            },

            init() {
                this.loadData();
                this.updateCurrentMonthDisplay();
                this.populateAnalysisSelectors();
                this.render();
                
                const now = new Date();
                now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
                document.getElementById('entry-date').value = now.toISOString().slice(0, 16);
            },

            // --- DATA MANAGEMENT ---
            loadData() {
                const savedData = localStorage.getItem('salaryManagementData');
                if (savedData) {
                    this.state.data = JSON.parse(savedData);
                    if (!this.state.data.incomeTypes) {
                        this.state.data.incomeTypes = ['Basic Salary', 'Service Charge', 'Tip'];
                    }
                    if (!this.state.data.settings) {
                        this.state.data.settings = { currencySymbol: 'Rs.' };
                    }
                }
            },

            saveData() {
                localStorage.setItem('salaryManagementData', JSON.stringify(this.state.data));
                this.populateAnalysisSelectors(); // Update year dropdown if new data is added for a new year
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
                return `
                    <li class="flex justify-between items-center bg-black bg-opacity-20 p-2 rounded-md">
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
                    alert('Please fill all fields correctly.');
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
                this.render();
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
                    this.state.data.entries = this.state.data.entries.filter(e => e.id !== entryId);
                    this.saveData();
                    this.render();
                }
            },
            
            // --- CATEGORY MANAGEMENT ---
            addExpenseCategory() {
                const input = document.getElementById('new-expense-category-input');
                const newCategory = input.value.trim();
                if (newCategory && !this.state.data.expenseCategories.includes(newCategory)) {
                    this.state.data.expenseCategories.push(newCategory);
                    this.saveData();
                    this.renderExpensesView(this.getEntriesForPeriod(new Date().getMonth(), new Date().getFullYear()));
                    input.value = '';
                } else if (!newCategory) {
                    alert('Category name cannot be empty.');
                } else {
                    alert('This category already exists.');
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
                    alert('A category with this name already exists.'); return;
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
                this.render();
            },

            deleteExpenseCategory(category) {
                const isUsed = this.state.data.entries.some(e => e.type === 'expense' && e.category === category);
                if (isUsed) {
                    alert('This category cannot be deleted because it has entries associated with it. Please move or delete those entries first.');
                    return;
                }
                if (confirm(`Are you sure you want to delete the category "${category}"?`)) {
                    this.state.data.expenseCategories = this.state.data.expenseCategories.filter(c => c !== category);
                    this.saveData();
                    this.render();
                }
            },

            addIncomeType() {
                const input = document.getElementById('new-income-type-input');
                const newType = input.value.trim();
                if (newType && !this.state.data.incomeTypes.includes(newType)) {
                    this.state.data.incomeTypes.push(newType);
                    this.saveData();
                    this.renderIncomesView(this.getEntriesForPeriod(new Date().getMonth(), new Date().getFullYear()));
                    input.value = '';
                } else if (!newType) {
                    alert('Income type name cannot be empty.');
                } else {
                    alert('This income type already exists.');
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
                    alert('An income type with this name already exists.'); return;
                }
                
                const typeIndex = this.state.data.incomeTypes.indexOf(oldType);
                if (typeIndex > -1) this.state.data.incomeTypes[typeIndex] = newType;

                this.state.data.entries.forEach(entry => {
                    if (entry.type === 'income' && entry.category === oldType) {
                        entry.category = newType;
                    }
                });

                this.saveData();
                this.render();
            },

            deleteIncomeType(type) {
                const isUsed = this.state.data.entries.some(e => e.type === 'income' && e.category === type);
                if (isUsed) {
                    alert('This income type cannot be deleted because it has entries associated with it. Please move or delete those entries first.');
                    return;
                }
                if (confirm(`Are you sure you want to delete the income type "${type}"?`)) {
                    this.state.data.incomeTypes = this.state.data.incomeTypes.filter(t => t !== type);
                    this.saveData();
                    this.render();
                }
            },
            
            // --- SETTINGS & BACKUP ---
            saveSettings() {
                this.state.data.settings.currencySymbol = document.getElementById('currency-symbol').value;
                this.saveData();
                this.render();
                alert('Settings saved!');
            },
            
            resetAllData() {
                if(confirm('WARNING: This will delete all your data permanently. Are you sure?')) {
                    localStorage.removeItem('salaryManagementData');
                    this.state.data = {
                        entries: [],
                        expenseCategories: ['Food', 'Transport', 'Bills', 'Entertainment', 'Other'],
                        incomeTypes: ['Basic Salary', 'Service Charge', 'Tip'],
                        settings: { currencySymbol: 'Rs.' }
                    };
                    this.init();
                }
            },
            
            exportData() {
                const dataStr = JSON.stringify(this.state.data, null, 2);
                const dataBlob = new Blob([dataStr], {type: "application/json"});
                const url = URL.createObjectURL(dataBlob);
                const link = document.createElement('a');
                const date = new Date().toISOString().slice(0, 10);
                link.download = `salary-manager-backup-${date}.json`;
                link.href = url;
                link.click();
                URL.revokeObjectURL(url);
                alert('Backup data has been exported.');
            },

            importData(event) {
                const file = event.target.files[0];
                if (!file) return;
                
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const importedData = JSON.parse(e.target.result);
                        // Basic validation
                        if (importedData.entries && importedData.expenseCategories && importedData.settings) {
                            if (confirm('Are you sure you want to overwrite all current data with the backup file?')) {
                                this.state.data = importedData;
                                this.saveData();
                                this.init();
                                alert('Data imported successfully!');
                            }
                        } else {
                            alert('Invalid backup file format.');
                        }
                    } catch (error) {
                        alert('Error reading or parsing the backup file.');
                        console.error(error);
                    } finally {
                        event.target.value = ''; // Reset file input
                    }
                };
                reader.readAsText(file);
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
            }
        };

        document.addEventListener('DOMContentLoaded', () => {
            app.init();
        });

        window.app = app;