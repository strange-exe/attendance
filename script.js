document.addEventListener("DOMContentLoaded", () => {
    const App = {
        // --- CONFIGURATION ---
        config: {
            STUDENT_COUNT: 80,
            PAGE_SIZE: 16,
            DEFAULT_ROSTER_KEY: "attendance_roster_v3",
            ATTENDANCE_KEY_PREFIX: "attendance_data_v3",
            SWIPE_THRESHOLD: 60,
        },

        // --- STATE ---
        state: {
            roster: [],
            attendance: new Map(),
            filteredRoster: [],
            currentPage: 0,
            isMobile: window.matchMedia("(max-width: 768px)").matches,
            touchStartX: 0,
            touchCurrentX: 0,
            activeSwipeEl: null,
            isSwiping: false,
        },

        // --- DOM ELEMENTS ---
        elements: {
            grid: document.getElementById("studentsGrid"),
            pageInfo: document.getElementById("pageInfo"),
            showCount: document.getElementById("showCount"),
            status: document.getElementById("status"),
            dateInput: document.getElementById("date"),
            sectionInput: document.getElementById("section"),
            subjectInput: document.getElementById("subject"),
            searchInput: document.getElementById("search"),
            jumpInput: document.getElementById("jump"),
            themeToggle: document.getElementById("themeToggle"),
        },

        // --- INITIALIZATION ---
        init() {
            this.setupTheme();
            this.bindEventListeners();
            this.listenForResize();
            this.elements.dateInput.value = new Date().toISOString().slice(0, 10);
            this.loadRoster();
            this.loadAttendanceForDate();
            this.filterRoster();
            this.render();
        },
        
        setupTheme() {
            const savedTheme = localStorage.getItem('theme') || 'light';
            document.body.classList.toggle('dark-mode', savedTheme === 'dark');
            this.elements.themeToggle.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
        },
        
        toggleTheme() {
            const isDark = document.body.classList.toggle('dark-mode');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            this.elements.themeToggle.textContent = isDark ? '☀️' : '🌙';
        },

        // --- CORE LOGIC ---
        loadRoster() {
            const localRoster = localStorage.getItem(this.config.DEFAULT_ROSTER_KEY);
            if (localRoster) {
                this.state.roster = JSON.parse(localRoster);
            } else {
                this.state.roster = Array.from({ length: this.config.STUDENT_COUNT }, (_, i) => ({
                    roll: i + 1,
                    name: `Student ${i + 1}`,
                }));
                // Save the generated roster for future use
                localStorage.setItem(this.config.DEFAULT_ROSTER_KEY, JSON.stringify(this.state.roster));
            }
        },
        
        loadAttendanceForDate() {
            const date = this.elements.dateInput.value;
            const key = `${this.config.ATTENDANCE_KEY_PREFIX}_${date}`;
            const savedData = JSON.parse(localStorage.getItem(key) || "{}");
            this.state.attendance.clear();
            this.state.roster.forEach(s => {
                this.state.attendance.set(s.roll, savedData[s.roll] || "Present");
            });
            this.render();
        },

        saveAttendanceLocally() {
            const date = this.elements.dateInput.value;
            const key = `${this.config.ATTENDANCE_KEY_PREFIX}_${date}`;
            const attendanceObj = Object.fromEntries(this.state.attendance);
            localStorage.setItem(key, JSON.stringify(attendanceObj));
            this.showStatus("Attendance saved locally!", "ok");
        },
        
        filterRoster() {
            const query = this.elements.searchInput.value.trim();
            if (!query) {
                this.state.filteredRoster = [...this.state.roster];
            } else {
                this.state.filteredRoster = this.state.roster.filter(s => 
                    String(s.roll).includes(query)
                );
            }
            this.state.currentPage = 0;
        },

        // --- RENDERING ---
        render() {
            const { currentPage, isMobile } = this.state;
            const { PAGE_SIZE } = this.config;
            const start = currentPage * PAGE_SIZE;
            const end = start + PAGE_SIZE;
            const pageItems = this.state.filteredRoster.slice(start, end);

            this.elements.grid.innerHTML = "";
            const fragment = document.createDocumentFragment();
            
            pageItems.forEach(student => {
                const status = this.state.attendance.get(student.roll) || "Present";
                const el = document.createElement("div");
                el.className = `student ${status.toLowerCase()}`;
                el.dataset.roll = student.roll;

                if (isMobile) {
                    el.innerHTML = `
                        <div class="swipe-action swipe-action-left">Absent</div>
                        <div class="swipe-action swipe-action-right">Present</div>
                        <div class="student-content">
                            <strong>#${student.roll}</strong>
                            <small>${student.name}</small>
                        </div>
                    `;
                } else {
                    el.role = "button";
                    el.tabIndex = 0;
                    el.innerHTML = `<strong>#${student.roll}</strong><small>${student.name}</small>`;
                }
                fragment.appendChild(el);
            });
            this.elements.grid.appendChild(fragment);

            const totalPages = Math.max(1, Math.ceil(this.state.filteredRoster.length / PAGE_SIZE));
            this.elements.pageInfo.textContent = `Page ${currentPage + 1} / ${totalPages}`;
            const absentCount = [...this.state.attendance.values()].filter(v => v === "Absent").length;
            this.elements.showCount.textContent = `${this.state.filteredRoster.length} (Absents: ${absentCount})`;
        },

        // --- EVENT HANDLERS & ACTIONS ---
        bindEventListeners() {
            this.elements.grid.addEventListener('touchstart', e => this.handleTouchStart(e), { passive: true });
            this.elements.grid.addEventListener('touchmove', e => this.handleTouchMove(e), { passive: false });
            this.elements.grid.addEventListener('touchend', e => this.handleTouchEnd(e));
            this.elements.grid.addEventListener('click', e => this.handleTap(e));
            this.elements.searchInput.addEventListener("input", () => {
                this.filterRoster();
                this.render();
            });
            this.elements.dateInput.addEventListener("change", () => this.loadAttendanceForDate());
            this.elements.themeToggle.addEventListener("click", () => this.toggleTheme());
            document.getElementById("markAllPresent").addEventListener("click", () => this.setAllStatus("Present"));
            document.getElementById("markAllAbsent").addEventListener("click", () => this.setAllStatus("Absent"));
            document.getElementById("invert").addEventListener("click", () => this.invertSelection());
            document.getElementById("prev").addEventListener("click", () => this.changePage(-1));
            document.getElementById("next").addEventListener("click", () => this.changePage(1));
            this.elements.jumpInput.addEventListener("keydown", e => {
                if (e.key === "Enter") this.jumpToRoll();
            });
            document.getElementById("saveLocal").addEventListener("click", () => this.saveAttendanceLocally());
            document.getElementById("exportPDF").addEventListener("click", () => this.exportPDF());
        },

        listenForResize() {
            window.addEventListener('resize', () => {
                const newIsMobile = window.matchMedia("(max-width: 768px)").matches;
                if (newIsMobile !== this.state.isMobile) {
                    this.state.isMobile = newIsMobile;
                    this.render();
                }
            });
        },
        
        updateStudentStatus(roll, newStatus) {
            if (this.state.attendance.get(roll) !== newStatus) {
                this.state.attendance.set(roll, newStatus);
                this.render();
            }
        },
        
        handleTap(e) {
            if (this.state.isSwiping) return;
            const studentEl = e.target.closest(".student");
            if (studentEl) {
                const roll = parseInt(studentEl.dataset.roll);
                const currentStatus = this.state.attendance.get(roll);
                this.updateStudentStatus(roll, currentStatus === "Present" ? "Absent" : "Present");
            }
        },

        // --- SWIPE LOGIC ---
        handleTouchStart(e) {
            if (!this.state.isMobile) return;
            const studentEl = e.target.closest('.student');
            if (!studentEl) return;
            this.state.activeSwipeEl = studentEl.querySelector('.student-content');
            this.state.touchStartX = e.touches[0].clientX;
            this.state.isSwiping = false;
            this.state.activeSwipeEl.classList.add('swiping');
        },

        handleTouchMove(e) {
            if (!this.state.activeSwipeEl || !this.state.isMobile) return;
            this.state.touchCurrentX = e.touches[0].clientX;
            const deltaX = this.state.touchCurrentX - this.state.touchStartX;
            if (Math.abs(deltaX) > 10 && !this.state.isSwiping) {
                this.state.isSwiping = true;
            }
            if (this.state.isSwiping) {
                e.preventDefault();
                this.state.activeSwipeEl.style.transform = `translateX(${deltaX}px)`;
            }
        },

        handleTouchEnd() {
            if (!this.state.activeSwipeEl || !this.state.isMobile) return;
            const deltaX = this.state.touchCurrentX - this.state.touchStartX;
            const roll = parseInt(this.state.activeSwipeEl.closest('.student').dataset.roll);
            if (Math.abs(deltaX) > this.config.SWIPE_THRESHOLD) {
                const newStatus = deltaX > 0 ? "Present" : "Absent";
                this.updateStudentStatus(roll, newStatus);
            }
            this.state.activeSwipeEl.classList.remove('swiping');
            this.state.activeSwipeEl.style.transform = 'translateX(0)';
            this.state.activeSwipeEl = null;
            this.state.touchStartX = 0;
            this.state.touchCurrentX = 0;
            setTimeout(() => { this.state.isSwiping = false; }, 100);
        },
        
        // --- BULK/PAGE ACTIONS ---
        setAllStatus(status) {
            this.state.roster.forEach(s => this.state.attendance.set(s.roll, status));
            this.render();
            this.showStatus(`All students marked as ${status}`, "ok");
        },

        invertSelection() {
            this.state.roster.forEach(s => {
                const current = this.state.attendance.get(s.roll);
                this.state.attendance.set(s.roll, current === "Present" ? "Absent" : "Present");
            });
            this.render();
            this.showStatus("Selection inverted", "ok");
        },

        changePage(direction) {
            const { currentPage, filteredRoster } = this.state;
            const { PAGE_SIZE } = this.config;
            const totalPages = Math.ceil(filteredRoster.length / PAGE_SIZE);
            const newPage = currentPage + direction;
            if (newPage >= 0 && newPage < totalPages) {
                this.state.currentPage = newPage;
                this.render();
            }
        },
        
        jumpToRoll() {
            const roll = parseInt(this.elements.jumpInput.value);
            if (isNaN(roll)) return;
            const index = this.state.filteredRoster.findIndex(s => s.roll === roll);
            if (index === -1) {
                return this.showStatus("Roll number not found in current filter.", "error");
            }
            this.state.currentPage = Math.floor(index / this.config.PAGE_SIZE);
            this.render();
            this.elements.jumpInput.value = '';
        },
        
        exportPDF() {
            if (typeof window.jspdf === 'undefined') {
                this.showStatus("PDF library not loaded.", "error");
                return;
            }

            const { sectionInput, subjectInput, dateInput } = this.elements;
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            if (typeof doc.autoTable === 'undefined') {
                this.showStatus("PDF-AutoTable library not loaded.", "error");
                return;
            }

            // --- Title Section ---
            doc.setFont("helvetica", "bold");
            doc.setFontSize(20);
            doc.text("Attendance Sheet", doc.internal.pageSize.getWidth() / 2, 20, { align: "center" });

            doc.setFontSize(11);
            doc.setFont("helvetica", "normal");
            doc.text(`Section: ${sectionInput.value}`, 14, 35);
            doc.text(`Subject: ${subjectInput.value}`, 14, 42);
            doc.text(`Date: ${dateInput.value}`, 14, 49);

            doc.setDrawColor(150);
            doc.setLineWidth(0.5);
            doc.line(14, 53, doc.internal.pageSize.getWidth() - 14, 53);

            const dataToExport = this.state.filteredRoster;
            const totalPagesExp = "{total_pages_count_string}";

            // --- Table ---
            doc.autoTable({
                startY: 58,
                head: [['Roll No.', 'Status']],
                body: dataToExport.map(s => [
                    s.roll,
                    this.state.attendance.get(s.roll)
                ]),
                theme: 'grid',
                styles: { font: "helvetica", fontSize: 10, cellPadding: 4, lineColor: [0, 0, 0], lineWidth: 0.3 },
                headStyles: { fillColor: [41, 128, 185], textColor: 255, halign: 'center' },
                bodyStyles: { halign: 'center' },
                alternateRowStyles: { fillColor: [245, 245, 245] },

                didParseCell: (data) => {
                    if (data.section === 'body' && data.column.index === 1) {
                        if (data.cell.raw === "Present") {
                            data.cell.styles.fillColor = [220, 245, 220];
                            data.cell.styles.textColor = [0, 128, 0];
                        } else if (data.cell.raw === "Absent") {
                            data.cell.styles.fillColor = [255, 220, 220];
                            data.cell.styles.textColor = [200, 0, 0];
                        }
                    }
                },

                didDrawPage: (data) => {
                    const pageSize = doc.internal.pageSize;
                    const pageHeight = pageSize.height;

                    // Footer: page numbers
                    doc.setFontSize(9);
                    doc.text(`Page ${data.pageNumber} of ${totalPagesExp}`,
                            pageSize.width - 10,
                            pageHeight - 10,
                            { align: "right" });
                }
            });

            // Replace page count placeholders
            if (typeof doc.putTotalPages === 'function') {
                doc.putTotalPages(totalPagesExp);
            }

            // --- ✅ Add summary ONLY on the last page ---
            const pageCount = doc.internal.getNumberOfPages();
            const pageSize = doc.internal.pageSize;
            const pageHeight = pageSize.height;

            doc.setPage(pageCount); // move cursor to last page

            const absentCount = [...this.state.attendance.values()].filter(v => v === "Absent").length;
            const presentCount = dataToExport.length - absentCount;
            const summaryText = `Attendance Summary: ${presentCount} Present  &  ${absentCount} Absent`;

            doc.setFontSize(11);
            doc.setTextColor(70);
            doc.setFont("helvetica", "bold");
            doc.text(summaryText, 14, pageHeight - 10); // left side bottom
            
            // Save file
            const timestamp = new Date().getTime();
            doc.save(`attendance_${sectionInput.value}_${dateInput.value}_${timestamp}.pdf`);
            this.showStatus("Beautifully formatted PDF exported successfully!", "ok");
        },

        // --- UTILITIES ---
        showStatus(message, type = "ok") {
            const { status } = this.elements;
            status.textContent = message;
            status.className = `toast show ${type}`;
            setTimeout(() => status.classList.remove("show"), 3000);
        },

        downloadBlob(content, filename, type) {
            const blob = new Blob([content], { type });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        },
    };

    App.init();
});