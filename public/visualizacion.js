document.addEventListener('DOMContentLoaded', () => {
    let categoriesState = [];
    let currentCategoryId = null;

    const modal = document.getElementById('excess-modal');
    const modalInput = document.getElementById('excess-amount');
    const modalAcceptBtn = document.getElementById('modal-accept');
    const modalCancelBtn = document.getElementById('modal-cancel');
    const finalMessageDiv = document.getElementById('final-message');

    // Formatear input del modal mientras se escribe
    modalInput.addEventListener('input', (e) => {
        let val = e.target.value.replace(/[^0-9.]/g, '');
        const parts = val.split('.');
        if (parts.length > 2) parts.pop();
        if (parts[0]) {
            parts[0] = parseInt(parts[0], 10).toLocaleString('en-US');
        }
        e.target.value = parts.join('.');
    });

    fetch('/api/finances')
        .then(response => response.json())
        .then(data => {
            if (!data || !data.income) {
                document.getElementById('period-display').textContent = 'No hay datos disponibles. Por favor, configura tu distribución primero.';
                return;
            }

            document.getElementById('period-display').textContent = `Periodo: ${data.period}`;
            document.getElementById('vis-income').textContent = formatCurrency(data.income);
            
            let totalAssigned = 0;
            const tbody = document.getElementById('vis-categories');

            data.categories.forEach((cat, index) => {
                let percentage = 0;
                let amount = 0;

                if (cat.type === 'percentage') {
                    percentage = cat.value;
                    amount = data.income * (cat.value / 100);
                } else if (cat.type === 'fixed') {
                    amount = cat.value;
                    percentage = (cat.value / data.income) * 100;
                }

                totalAssigned += amount;

                // Guardar el estado inicial para la verificación
                categoriesState.push({
                    id: index,
                    name: cat.name,
                    assignedAmount: amount,
                    status: 'pending', // pending | fulfilled | exceeded
                    actualAmount: 0
                });

                const tr = document.createElement('tr');
                tr.id = `cat-row-${index}`;
                tr.innerHTML = `
                    <td>${cat.name}</td>
                    <td>${percentage.toFixed(2)}%</td>
                    <td>${formatCurrency(amount)}</td>
                    <td>
                        <div class="action-buttons" id="actions-${index}">
                            <button class="btn-icon btn-check" onclick="markFulfilled(${index})" title="Cumplido">✓</button>
                            <button class="btn-icon btn-cross" onclick="promptExcess(${index})" title="Excedido">✕</button>
                        </div>
                        <div id="status-text-${index}" style="display: none; font-weight: 600;"></div>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            document.getElementById('vis-assigned').textContent = formatCurrency(totalAssigned);
        })
        .catch(error => {
            console.error('Error fetching data:', error);
            document.getElementById('period-display').textContent = 'Error al cargar los datos.';
        });

    window.markFulfilled = function(id) {
        categoriesState[id].status = 'fulfilled';
        categoriesState[id].actualAmount = categoriesState[id].assignedAmount;
        
        updateRowUI(id, '¡Logrado!', 'var(--primary-color)');
        checkCompletion();
    };

    window.promptExcess = function(id) {
        currentCategoryId = id;
        modalInput.value = '';
        modal.classList.add('active');
        modalInput.focus();
    };

    modalCancelBtn.addEventListener('click', () => {
        modal.classList.remove('active');
        currentCategoryId = null;
    });

    modalAcceptBtn.addEventListener('click', () => {
        const valStr = modalInput.value.replace(/,/g, '');
        const excess = parseFloat(valStr);

        if (isNaN(excess) || excess <= 0) {
            alert('Por favor ingresa un monto excedente válido mayor a 0.');
            return;
        }

        const cat = categoriesState[currentCategoryId];
        cat.status = 'exceeded';
        cat.actualAmount = cat.assignedAmount + excess;

        let text = `Se pasó por ${formatCurrency(excess)}`;
        updateRowUI(currentCategoryId, text, 'var(--danger-color)');

        modal.classList.remove('active');
        checkCompletion();
    });

    function updateRowUI(id, text, color) {
        document.getElementById(`actions-${id}`).style.display = 'none';
        const statusText = document.getElementById(`status-text-${id}`);
        statusText.style.display = 'block';
        statusText.style.color = color;
        statusText.textContent = text;
    }

    function checkCompletion() {
        const allProcessed = categoriesState.every(cat => cat.status !== 'pending');
        
        if (allProcessed) {
            const hasExcess = categoriesState.some(cat => cat.status === 'exceeded');
            
            if (hasExcess) {
                finalMessageDiv.textContent = '¡Ánimo! Hubo algunos excedentes, pero el próximo periodo habrá otra oportunidad para mejorar.';
                finalMessageDiv.className = 'msg-warning';
            } else {
                finalMessageDiv.textContent = '¡Felicitaciones! Has cumplido tu presupuesto a la perfección en todas las categorías.';
                finalMessageDiv.className = 'msg-success';
            }
        }
    }

    function formatCurrency(amount) {
        return '$' + amount.toLocaleString('en-US', { maximumFractionDigits: 0 });
    }
});