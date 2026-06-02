document.addEventListener('DOMContentLoaded', () => {
    const incomeInput = document.getElementById('income');
    const periodSelect = document.getElementById('period');
    const addCategoryBtn = document.getElementById('add-category-btn');
    const categoriesContainer = document.getElementById('categories-container');
    const template = document.getElementById('category-template');
    const saveBtn = document.getElementById('save-btn');
    const validationMessage = document.getElementById('validation-message');

    let currentIncome = 0;

    init();

    function formatInputNumber(e) {
        let val = e.target.value.replace(/[^0-9.]/g, '');
        const parts = val.split('.');
        if (parts.length > 2) parts.pop();
        if (parts[0]) {
            parts[0] = parseInt(parts[0], 10).toLocaleString('en-US');
        }
        e.target.value = parts.join('.');
    }

    function init() {
        fetchData();
        incomeInput.addEventListener('input', formatInputNumber);
        incomeInput.addEventListener('input', handleIncomeChange);
        addCategoryBtn.addEventListener('click', () => addCategoryRow());
        saveBtn.addEventListener('click', saveData);

        if (categoriesContainer.children.length === 0) {
            addCategoryRow();
        }
    }

    function handleIncomeChange() {
        currentIncome = parseFloat(incomeInput.value.replace(/,/g, '')) || 0;
        updateSummary();
    }

    function addCategoryRow(categoryData = null) {
        const clone = template.content.cloneNode(true);
        const categoryItem = clone.querySelector('.category-item');
        
        const nameInput = categoryItem.querySelector('.cat-name');
        const typeSelect = categoryItem.querySelector('.cat-type');
        const valueInput = categoryItem.querySelector('.cat-value');
        const removeBtn = categoryItem.querySelector('.btn-remove-cat');

        if (categoryData) {
            nameInput.value = categoryData.name;
            typeSelect.value = categoryData.type;
            
            let valStr = categoryData.value.toString();
            const parts = valStr.split('.');
            parts[0] = parseInt(parts[0], 10).toLocaleString('en-US');
            valueInput.value = parts.join('.');
        }

        typeSelect.addEventListener('change', updateSummary);
        valueInput.addEventListener('input', formatInputNumber);
        valueInput.addEventListener('input', updateSummary);
        
        removeBtn.addEventListener('click', () => {
            categoryItem.remove();
            updateSummary();
        });

        categoriesContainer.appendChild(categoryItem);
        updateSummary();
    }

    function updateSummary() {
        const rows = categoriesContainer.querySelectorAll('.category-item');
        let totalAssigned = 0;

        rows.forEach(row => {
            const type = row.querySelector('.cat-type').value;
            const value = parseFloat(row.querySelector('.cat-value').value.replace(/,/g, '')) || 0;
            const calcSpan = row.querySelector('.cat-calculated-amount');

            let calculatedAmount = 0;

            if (type === 'percentage') {
                calculatedAmount = currentIncome * (value / 100);
            } else if (type === 'fixed') {
                calculatedAmount = value;
            }

            calcSpan.textContent = formatCurrency(calculatedAmount);
            totalAssigned += calculatedAmount;
        });

        const remaining = currentIncome - totalAssigned;
        validateForm(remaining, totalAssigned);
    }

    function validateForm(remaining, totalAssigned) {
        const rows = categoriesContainer.querySelectorAll('.category-item');
        
        if (currentIncome <= 0) {
            validationMessage.textContent = 'Ingresa un monto de ingreso válido.';
            validationMessage.className = 'validation-message validation-error';
            saveBtn.disabled = true;
            return;
        }

        if (rows.length === 0) {
            validationMessage.textContent = 'Añade al menos una categoría de gasto.';
            validationMessage.className = 'validation-message validation-error';
            saveBtn.disabled = true;
            return;
        }

        if (Math.abs(remaining) > 0.01) {
            if (remaining > 0) {
                validationMessage.textContent = `Aún falta asignar ${formatCurrency(remaining)} (o el equivalente en %).`;
            } else {
                validationMessage.textContent = `Has excedido tu ingreso por ${formatCurrency(Math.abs(remaining))}.`;
            }
            validationMessage.className = 'validation-message validation-error';
            saveBtn.disabled = true;
        } else {
            validationMessage.textContent = '¡Distribución perfecta! El 100% ha sido asignado.';
            validationMessage.className = 'validation-message validation-success';
            saveBtn.disabled = false;
        }
    }

    function formatCurrency(amount) {
        return '$' + amount.toLocaleString('en-US', { maximumFractionDigits: 0 });
    }

    function getFormData() {
        const rows = categoriesContainer.querySelectorAll('.category-item');
        const categories = [];

        rows.forEach(row => {
            const name = row.querySelector('.cat-name').value;
            const type = row.querySelector('.cat-type').value;
            const value = parseFloat(row.querySelector('.cat-value').value.replace(/,/g, '')) || 0;

            if (name.trim() !== '') {
                categories.push({ name, type, value });
            }
        });

        return {
            period: periodSelect.value,
            income: currentIncome,
            categories: categories
        };
    }

    function saveData() {
        const data = getFormData();
        
        saveBtn.disabled = true;
        saveBtn.textContent = 'Guardando...';

        fetch('/api/finances', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
        .then(response => {
            if (!response.ok) throw new Error('Error al guardar');
            return response.json();
        })
        .then(result => {
            validationMessage.textContent = '¡Datos guardados exitosamente! Redirigiendo a visualización...';
            validationMessage.className = 'validation-message validation-success';
            setTimeout(() => {
                window.location.href = 'visualizacion.html';
            }, 1000);
        })
        .catch(error => {
            validationMessage.textContent = 'Error al guardar los datos.';
            validationMessage.className = 'validation-message validation-error';
            saveBtn.textContent = 'Guardar Distribución';
            saveBtn.disabled = false;
        });
    }

    function fetchData() {
        fetch('/api/finances')
            .then(response => response.json())
            .then(data => {
                if (data.income) {
                    let incStr = data.income.toString();
                    const parts = incStr.split('.');
                    parts[0] = parseInt(parts[0], 10).toLocaleString('en-US');
                    incomeInput.value = parts.join('.');
                    currentIncome = data.income;
                }
                if (data.period) {
                    periodSelect.value = data.period;
                }
                if (data.categories && data.categories.length > 0) {
                    categoriesContainer.innerHTML = '';
                    data.categories.forEach(cat => addCategoryRow(cat));
                }
                updateSummary();
            })
            .catch(error => console.error('Error fetching data:', error));
    }
});