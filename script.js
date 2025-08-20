document.addEventListener("DOMContentLoaded", () => {
    const App = {
        config: {
            STUDENT_COUNT: 80,
            PAGE_SIZE: 16,
            DEFAULT_ROSTER_KEY: "attendance_roster_v3",
            ATTENDANCE_KEY_PREFIX: "attendance_data_v3",
        },

        state: {
            roster: [],
            attendance: new Map(),
            filteredRoster: [],
            currentPage: 0,
        },

        elements: {
            grid: document.getElementById("studentsGrid"),
            pageInfo: document.getElementById("pageInfo"),
            showCount: document.getElementById("showCount"),
            summaryBar: document.getElementById("summaryBar"),
            quickRoll: document.getElementById("quickRoll"), 
            status: document.getElementById("status"),
            dateInput: document.getElementById("date"),
            sectionInput: document.getElementById("section"),
            subjectInput: document.getElementById("subject"),
            searchInput: document.getElementById("search"),
            jumpInput: document.getElementById("jump"),
            themeToggle: document.getElementById("themeToggle"),
        },

        init() {
            this.setupTheme();
            this.bindEventListeners();
            this.elements.dateInput.value = new Date().toISOString().slice(0, 10);
            this.loadRoster();
            this.loadAttendanceForDate();
            this.filterRoster();
            this.render();
        },
        
        setupTheme() {
            document.body.classList.add("dark-mode");
            localStorage.setItem("theme", "dark");
            this.elements.themeToggle.textContent = "☀️";
        },
        
        toggleTheme() {
            const isDark = document.body.classList.toggle("dark-mode");
            localStorage.setItem("theme", isDark ? "dark" : "light");
            this.elements.themeToggle.textContent = isDark ? "☀️" : "🌙";
        },

        loadRoster() {
            const localRoster = localStorage.getItem(this.config.DEFAULT_ROSTER_KEY);
            if (localRoster) {
                this.state.roster = JSON.parse(localRoster);
            } else {
                this.state.roster = Array.from({ length: this.config.STUDENT_COUNT }, (_, i) => ({
                    roll: i + 1,
                    name: `Student ${i + 1}`,
                }));
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
        },

        render() {
            const { currentPage } = this.state;
            const { PAGE_SIZE } = this.config;
            const start = currentPage * PAGE_SIZE;
            const end = start + PAGE_SIZE;
            const pageItems = this.state.filteredRoster.slice(start, end);

            this.elements.grid.innerHTML = "";
            const fragment = document.createDocumentFragment();
            
            pageItems.forEach(student => {
                const status = this.state.attendance.get(student.roll) || "Present";
                const el = document.createElement("div");
                el.className = `student ${status.toLowerCase()} animate`;
                el.dataset.roll = student.roll;
                el.role = "button";
                el.tabIndex = 0;
                el.innerHTML = `<strong>#${student.roll}</strong><small>${student.name}</small>`;
                fragment.appendChild(el);
            });
            this.elements.grid.appendChild(fragment);

            const totalPages = Math.max(1, Math.ceil(this.state.filteredRoster.length / PAGE_SIZE));
            this.elements.pageInfo.textContent = `Page ${currentPage + 1} / ${totalPages}`;
            const total = this.state.roster.length;
            const absent = [...this.state.attendance.values()].filter(v => v === "Absent").length;
            const present = total - absent;
            this.elements.summaryBar.textContent = `Total: ${total} | Present: ${present} | Absent: ${absent}`;
            this.elements.quickRoll.innerHTML = [...this.state.attendance.entries()]
                .filter(([_, status]) => status === "Absent")
                .map(([roll]) => `#${roll} - ${this.state.roster.find(s => s.roll === roll)?.name || ""}`)
                .join("<br>");
        },

        bindEventListeners() {
            this.elements.grid.addEventListener("click", e => this.handleTap(e));

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
            document.getElementById("exportCSV").addEventListener("click", () => this.exportCSV());
        },
        
        updateStudentStatus(roll, newStatus) {
            this.state.attendance.set(roll, newStatus);
            this.render();
        },
        
        handleTap(e) {
            const studentEl = e.target.closest(".student");
            if (studentEl) {
                const roll = parseInt(studentEl.dataset.roll);
                const currentStatus = this.state.attendance.get(roll);
                this.updateStudentStatus(roll, currentStatus === "Present" ? "Absent" : "Present");
            }
        },

        setAllStatus(status) {
            this.state.roster.forEach(s => this.state.attendance.set(s.roll, status));
            this.render();
        },

        invertSelection() {
            this.state.roster.forEach(s => {
                const current = this.state.attendance.get(s.roll);
                this.state.attendance.set(s.roll, current === "Present" ? "Absent" : "Present");
            });
            this.render();
        },

        changePage(dir) {
            const totalPages = Math.max(1, Math.ceil(this.state.filteredRoster.length / this.config.PAGE_SIZE));
            this.state.currentPage = Math.max(0, Math.min(this.state.currentPage + dir, totalPages - 1));
            this.render();
        },

        jumpToRoll() {
            const roll = parseInt(this.elements.jumpInput.value);
            if (isNaN(roll)) return;
            const index = this.state.filteredRoster.findIndex(s => s.roll === roll);
            if (index >= 0) {
                this.state.currentPage = Math.floor(index / this.config.PAGE_SIZE);
                this.render();
                const el = this.elements.grid.querySelector(`[data-roll="${roll}"]`);
                if (el) el.classList.add("highlight");
                setTimeout(() => el?.classList.remove("highlight"), 1500);
            }
        },

        exportCSV() {
            const date = this.elements.dateInput.value;
            let csv = "Roll,Name,Status\n";
            this.state.roster.forEach(s => {
                csv += `${s.roll},${s.name},${this.state.attendance.get(s.roll) || "Present"}\n`;
            });
            const blob = new Blob([csv], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `attendance_${date}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        },

        showStatus(msg, type) {
            this.elements.status.textContent = msg;
            this.elements.status.className = type;
            setTimeout(() => this.elements.status.textContent = "", 3000);
        }
    };

    App.init();
});

