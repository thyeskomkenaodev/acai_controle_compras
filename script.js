// State Management
let items = JSON.parse(localStorage.getItem('acai_ranch_items')) || [];
let financeData = JSON.parse(localStorage.getItem('acai_ranch_finance')) || { revenue: 0, budget: 0 };
let currentDate = new Date();
let activeTab = 'adicionais';
let editMode = false;
let rankingChart = null;

// DOM Elements
const inventoryBody = document.getElementById('inventoryBody');
const currentPeriodDisplay = document.getElementById('currentPeriodDisplay');
const totalInvestmentDisplay = document.getElementById('totalInvestmentDisplay');
const totalProfitDisplay = document.getElementById('totalProfitDisplay');
const budgetBar = document.getElementById('budgetBar');
const budgetLabel = document.getElementById('budgetLabel');
const marginLabel = document.getElementById('marginLabel');
const lowStockCount = document.getElementById('lowStockCount');
const itemModal = document.getElementById('itemModal');
const itemForm = document.getElementById('itemForm');
const modalTitle = document.getElementById('modalTitle');
const searchInput = document.getElementById('searchInput');
const revenueInput = document.getElementById('revenueInput');
const budgetInput = document.getElementById('budgetInput');
const tableContainer = document.querySelector('.table-container');
const actionsBar = document.querySelector('.actions-bar');
const reportsSection = document.getElementById('reportsSection');
const saveIndicator = document.getElementById('saveIndicator');

// --- Fortnight Logic ---

function getFortnightId(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const fortnight = date.getDate() <= 15 ? 1 : 2;
    return `${year}-${month.toString().padStart(2, '0')}-${fortnight}`;
}

function getPreviousFortnightId(date) {
    const prev = new Date(date);
    if (prev.getDate() > 15) {
        prev.setDate(1);
    } else {
        prev.setMonth(prev.getMonth() - 1);
        prev.setDate(16);
    }
    return getFortnightId(prev);
}

function getFortnightLabel(date) {
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const fortnight = date.getDate() <= 15 ? '1ª Quinzena' : '2ª Quinzena';
    return `${fortnight} - ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function changeFortnight(direction) {
    const currentDay = currentDate.getDate();
    if (direction === 'next') {
        if (currentDay <= 15) {
            currentDate.setDate(16);
        } else {
            currentDate.setMonth(currentDate.getMonth() + 1);
            currentDate.setDate(1);
        }
    } else {
        if (currentDay > 15) {
            currentDate.setDate(1);
        } else {
            currentDate.setMonth(currentDate.getMonth() - 1);
            currentDate.setDate(16);
        }
    }
    render();
}

// --- Data Management ---

function showSaveIndicator() {
    saveIndicator.style.opacity = '1';
    setTimeout(() => {
        saveIndicator.style.opacity = '0';
    }, 2000);
}

function saveToLocalStorage() {
    localStorage.setItem('acai_ranch_items', JSON.stringify(items));
    localStorage.setItem('acai_ranch_finance', JSON.stringify(financeData));
    showSaveIndicator();
}

function getPeriodData(item, periodId) {
    if (!item.periods) item.periods = {};
    if (!item.periods[periodId]) {
        const prevId = getPreviousFortnightId(currentDate);
        const prevData = item.periods[prevId];
        
        item.periods[periodId] = {
            initial: prevData ? prevData.final : 0,
            purchases: 0,
            final: prevData ? prevData.final : 0,
            unitPrice: prevData ? prevData.unitPrice : 0
        };
    }
    return item.periods[periodId];
}

function quickUpdateQty(itemId, change) {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    const periodId = getFortnightId(currentDate);
    const data = getPeriodData(item, periodId);
    data.final = Math.max(0, data.final + change);
    saveToLocalStorage();
    render();
}

function exportPDF() {
    const element = document.querySelector('.container');
    const periodLabel = getFortnightLabel(currentDate);
    
    // Elements to hide in the PDF
    const elementsToHide = document.querySelectorAll('.tabs, .actions-bar, .fortnight-selector button, .actions-cell, #saveIndicator, .btn-add, #reportsSection, .finance-config');
    
    // Switch to a clean printable layout
    const originalTableDisplay = tableContainer.style.display;
    const originalReportsDisplay = reportsSection.style.display;
    
    elementsToHide.forEach(el => el.style.display = 'none');
    tableContainer.style.display = 'block';

    const opt = {
        margin: [10, 10],
        filename: `Relatorio_Acai_Ranch_${periodLabel.replace(/ /g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    const pdfBtn = document.getElementById('exportPDF');
    const originalBtnContent = pdfBtn.innerHTML;
    pdfBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando...';
    pdfBtn.disabled = true;

    setTimeout(() => {
        html2pdf().set(opt).from(element).save().then(() => {
            pdfBtn.innerHTML = originalBtnContent;
            pdfBtn.disabled = false;
            elementsToHide.forEach(el => el.style.display = '');
            tableContainer.style.display = originalTableDisplay;
            reportsSection.style.display = originalReportsDisplay;
        }).catch(err => {
            console.error('Erro:', err);
            pdfBtn.innerHTML = originalBtnContent;
            pdfBtn.disabled = false;
            elementsToHide.forEach(el => el.style.display = '');
            tableContainer.style.display = originalTableDisplay;
            reportsSection.style.display = originalReportsDisplay;
        });
    }, 500);
}

// --- Report Logic ---

function renderRankingChart() {
    const periodId = getFortnightId(currentDate);
    
    const rankingData = items
        .filter(item => item.category === 'adicionais')
        .map(item => {
            const data = getPeriodData(item, periodId);
            const used = (data.initial + data.purchases) - data.final;
            return {
                name: item.name,
                used: used > 0 ? used : 0,
                unit: item.unit
            };
        })
        .sort((a, b) => b.used - a.used)
        .slice(0, 10);

    const ctx = document.getElementById('rankingChart').getContext('2d');
    
    if (rankingChart) {
        rankingChart.destroy();
    }

    rankingChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: rankingData.map(d => d.name),
            datasets: [{
                label: 'Quantidade Utilizada',
                data: rankingData.map(d => d.used),
                backgroundColor: '#7c3aed',
                borderColor: '#5b21b6',
                borderWidth: 1,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const item = rankingData[context.dataIndex];
                            return `Utilizado: ${context.parsed.y} ${item.unit}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.05)' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

// --- UI Rendering ---

function render() {
    const periodId = getFortnightId(currentDate);
    currentPeriodDisplay.textContent = getFortnightLabel(currentDate);

    // Update Finance Inputs
    const periodFinanceKey = `f_${periodId}`;
    if (!financeData[periodFinanceKey]) {
        financeData[periodFinanceKey] = { revenue: 0, budget: 0 };
    }
    revenueInput.value = financeData[periodFinanceKey].revenue || '';
    budgetInput.value = financeData[periodFinanceKey].budget || '';

    if (activeTab === 'relatorios') {
        tableContainer.style.display = 'none';
        actionsBar.style.display = 'none';
        reportsSection.style.display = 'block';
        renderRankingChart();
    } else {
        tableContainer.style.display = 'block';
        actionsBar.style.display = 'flex';
        reportsSection.style.display = 'none';

        const filteredItems = items.filter(item => {
            const matchesTab = item.category === activeTab;
            const matchesSearch = item.name.toLowerCase().includes(searchInput.value.toLowerCase());
            return matchesTab && matchesSearch;
        });

        inventoryBody.innerHTML = '';
        let totalInvestment = 0;
        let totalConsumedCost = 0;
        let lowStockItems = 0;

        filteredItems.forEach(item => {
            const data = getPeriodData(item, periodId);
            const purchaseTotal = data.purchases * data.unitPrice;
            
            const usedQty = (data.initial + data.purchases) - data.final;
            const consumedCost = (usedQty > 0 ? usedQty : 0) * data.unitPrice;
            
            totalInvestment += purchaseTotal;
            totalConsumedCost += consumedCost;

            let statusClass = 'status-ok';
            let statusText = 'Normal';
            if (data.final <= 0 && (data.initial > 0 || data.purchases > 0)) {
                statusClass = 'status-out';
                statusText = 'Esgotado';
                lowStockItems++;
            } else if (data.final <= item.minStock) {
                statusClass = 'status-low';
                statusText = 'Baixo';
                lowStockItems++;
            }

            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${item.name}</strong></td>
                <td>${item.unit}</td>
                <td>${data.initial}</td>
                <td>${data.purchases}</td>
                <td>
                    <div class="qty-control">
                        <button class="qty-btn" onclick="quickUpdateQty('${item.id}', -1)">-</button>
                        <span>${data.final}</span>
                        <button class="qty-btn" onclick="quickUpdateQty('${item.id}', 1)">+</button>
                    </div>
                </td>
                <td>R$ ${data.unitPrice.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                <td style="color: var(--danger); font-weight: 600;">R$ ${purchaseTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                <td style="color: var(--primary); font-weight: 600;">R$ ${consumedCost.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td class="actions-cell">
                    <button class="action-btn edit" onclick="editItem('${item.id}')"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete" onclick="deleteItem('${item.id}')"><i class="fas fa-trash"></i></button>
                </td>
            `;
            inventoryBody.appendChild(row);
        });

        // Profit & Budget Calculations
        const currentRevenue = financeData[periodFinanceKey].revenue || 0;
        const currentBudget = financeData[periodFinanceKey].budget || 0;
        
        const grossProfit = currentRevenue - totalConsumedCost;
        const profitMargin = currentRevenue > 0 ? (grossProfit / currentRevenue) * 100 : 0;
        
        totalInvestmentDisplay.textContent = `R$ ${totalInvestment.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        totalProfitDisplay.textContent = `R$ ${grossProfit.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        totalProfitDisplay.style.color = grossProfit >= 0 ? 'var(--success)' : 'var(--danger)';
        marginLabel.textContent = `Margem: ${profitMargin.toFixed(1)}%`;
        
        // Budget Progress
        budgetLabel.textContent = `Orçamento: R$ ${currentBudget.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        const budgetPercent = currentBudget > 0 ? (totalInvestment / currentBudget) * 100 : 0;
        budgetBar.style.width = `${Math.min(100, budgetPercent)}%`;
        budgetBar.className = `budget-progress-bar ${budgetPercent > 100 ? 'danger' : ''}`;
        
        lowStockCount.textContent = lowStockItems;
    }
}

// --- Event Handlers ---

document.getElementById('saveFinance').addEventListener('click', () => {
    const periodId = getFortnightId(currentDate);
    const periodFinanceKey = `f_${periodId}`;
    
    financeData[periodFinanceKey] = {
        revenue: parseFloat(revenueInput.value) || 0,
        budget: parseFloat(budgetInput.value) || 0
    };
    
    saveToLocalStorage();
    render();
});

document.getElementById('openAddModal').addEventListener('click', () => {
    editMode = false;
    modalTitle.textContent = 'Novo Item';
    itemForm.reset();
    document.getElementById('itemId').value = '';
    itemModal.classList.add('active');
});

document.getElementById('closeModal').addEventListener('click', () => itemModal.classList.remove('active'));
document.getElementById('cancelBtn').addEventListener('click', () => itemModal.classList.remove('active'));
document.getElementById('exportPDF').addEventListener('click', exportPDF);

itemForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const periodId = getFortnightId(currentDate);
    const id = document.getElementById('itemId').value || Date.now().toString();
    
    const itemData = {
        id: id,
        name: document.getElementById('itemName').value,
        category: document.getElementById('itemCategory').value,
        unit: document.getElementById('itemUnit').value,
        minStock: parseFloat(document.getElementById('itemMinStock').value) || 0
    };

    const periodValues = {
        initial: parseFloat(document.getElementById('itemInitialStock').value) || 0,
        purchases: parseFloat(document.getElementById('itemPurchases').value) || 0,
        final: parseFloat(document.getElementById('itemFinalStock').value) || 0,
        unitPrice: parseFloat(document.getElementById('itemUnitPrice').value) || 0
    };

    if (editMode) {
        const index = items.findIndex(i => i.id === id);
        if (index !== -1) {
            items[index] = { ...items[index], ...itemData };
            items[index].periods[periodId] = periodValues;
        }
    } else {
        const newItem = {
            ...itemData,
            periods: {
                [periodId]: periodValues
            }
        };
        items.push(newItem);
    }

    saveToLocalStorage();
    render();
    itemModal.classList.remove('active');
});

function editItem(id) {
    const item = items.find(i => i.id === id);
    if (!item) return;

    const periodId = getFortnightId(currentDate);
    const data = getPeriodData(item, periodId);

    editMode = true;
    modalTitle.textContent = 'Editar Item';
    document.getElementById('itemId').value = item.id;
    document.getElementById('itemName').value = item.name;
    document.getElementById('itemCategory').value = item.category;
    document.getElementById('itemUnit').value = item.unit;
    document.getElementById('itemMinStock').value = item.minStock;
    
    document.getElementById('itemInitialStock').value = data.initial;
    document.getElementById('itemPurchases').value = data.purchases;
    document.getElementById('itemFinalStock').value = data.final;
    document.getElementById('itemUnitPrice').value = data.unitPrice;

    itemModal.classList.add('active');
}

function deleteItem(id) {
    if (confirm('Tem certeza que deseja excluir este item?')) {
        items = items.filter(i => i.id !== id);
        saveToLocalStorage();
        render();
    }
}

// Navigation Events
document.getElementById('prevFortnight').addEventListener('click', () => changeFortnight('prev'));
document.getElementById('nextFortnight').addEventListener('click', () => changeFortnight('next'));

// Tab Events
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeTab = btn.dataset.tab;
        render();
    });
});

// Search Event
searchInput.addEventListener('input', render);

// Initialize
render();
