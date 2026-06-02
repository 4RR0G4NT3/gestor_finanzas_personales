document.addEventListener('DOMContentLoaded', () => {
    // Referencias a elementos del DOM
    const incomeInput = document.getElementById('income');
    const periodSelect = document.getElementById('period');
    const addCategoryBtn = document.getElementById('add-category-btn');
    const categoriesContainer = document.getElementById('categories-container');
    const template = document.getElementById('category-template');
    
    const summaryIncome = document.getElementById('summary-income');
    const summaryAssigned = document.getElementById('summary-assigned');
    const summaryRemaining = document.getElementById('summary-remaining');
    
    const saveBtn = document.getElementById('save-btn');
    const validationMessage = document.getElementById('validation-message');

    // Estado de la aplicación
    let currentIncome = 0;

    // Inicialización
    init();

    function init() {
        // Cargar datos existentes si los hay
        fetchData();

        // Event Listeners
        incomeInput.addEventListener('input', handleIncomeChange);
        addCategoryBtn.addEventListener('click', addCategoryRow);
        saveBtn.addEventListener('click', saveData);

        // Añadir una categoría inicial por defecto si el contenedor está vacío
        if (categoriesContainer.children.length === 0) {
            addCategoryRow();
        }
    }

    function handleIncomeChange() {
        currentIncome = parseFloat(incomeInput.value) || 0;
        updateSummary();
    }

    function addCategoryRow(categoryData = null) {
        const clone = template.content.cloneNode(true);
        const categoryItem = clone.querySelector('.category-item');
        
        const nameInput = categoryItem.querySelector('.cat-name');
        const typeSelect = categoryItem.querySelector('.cat-type');
        const valueInput = categoryItem.querySelector('.cat-value');
        const removeBtn = categoryItem.querySelector('.btn-remove-cat');

        // Si se proveen datos, rellenar los campos
        if (categoryData) {
            nameInput.value = categoryData.name;
            typeSelect.value = categoryData.type;
            valueInput.value = categoryData.value;
        }

        // Listeners para los inputs de esta fila
        typeSelect.addEventListener('change', updateSummary);
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
            const value = parseFloat(row.querySelector('.cat-value').value) || 0;
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

        // Actualizar UI
        summaryIncome.textContent = formatCurrency(currentIncome);
        summaryAssigned.textContent = formatCurrency(totalAssigned);
        summaryRemaining.textContent = formatCurrency(remaining);

        // Estilos para el restante
        if (remaining < 0) {
            summaryRemaining.className = 'negative';
        } else if (remaining === 0 && currentIncome > 0) {
            summaryRemaining.className = 'positive';
        } else {
            summaryRemaining.className = '';
        }

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

        // Tolerancia para errores de redondeo de punto flotante
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
        return '$' + amount.toFixed(2);
    }

    function getFormData() {
        const rows = categoriesContainer.querySelectorAll('.category-item');
        const categories = [];

        rows.forEach(row => {
            const name = row.querySelector('.cat-name').value;
            const type = row.querySelector('.cat-type').value;
            const value = parseFloat(row.querySelector('.cat-value').value) || 0;

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
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response => {
            if (!response.ok) throw new Error('Error al guardar');
            return response.json();
        })
        .then(result => {
            validationMessage.textContent = '¡Datos guardados exitosamente!';
            validationMessage.className = 'validation-message validation-success';
            setTimeout(() => {
                updateSummary(); // Resetear mensaje
            }, 3000);
        })
        .catch(error => {
            validationMessage.textContent = 'Error al guardar los datos.';
            validationMessage.className = 'validation-message validation-error';
        })
        .finally(() => {
            saveBtn.textContent = 'Guardar Distribución';
            saveBtn.disabled = false;
        });
    }

    function fetchData() {
        fetch('/api/finances')
            .then(response => response.json())
            .then(data => {
                if (data.income) {
                    incomeInput.value = data.income;
                    currentIncome = data.income;
                }
                if (data.period) {
                    periodSelect.value = data.period;
                }
                if (data.categories && data.categories.length > 0) {
                    categoriesContainer.innerHTML = ''; // Limpiar categorías por defecto
                    data.categories.forEach(cat => addCategoryRow(cat));
                }
                updateSummary();
            })
            .catch(error => console.error('Error fetching data:', error));
    }
});