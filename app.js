/* ============================================
   FORMA — App Logic
   Multi-step form, webhook submit, preview, Stripe
   ============================================ */

(function () {
    'use strict';

    // =============================================
    // CONFIG — Update these before going live
    // =============================================
    const CONFIG = {
        // ⬇️ PASTE YOUR N8N WEBHOOK URL BELOW
        webhookUrl: 'https://akalanka29.app.n8n.cloud/webhook/b08a87c2-d693-47bf-9305-3fd755ceccd7',
        // ⬇️ PASTE YOUR PAYPAL PAYMENT LINK BELOW
        // This can be a PayPal.me link, PayPal hosted button URL, or PayPal checkout link
        paypalCheckoutUrl: 'PASTE_YOUR_PAYPAL_PAYMENT_LINK_HERE',
    };

    // =============================================
    // DOM REFS
    // =============================================
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const form = $('#intake-form');
    const formWrapper = $('#form-wrapper');
    const formSection = $('#form-section');
    const loadingScreen = $('#loading-screen');
    const previewSection = $('#preview-section');
    const progressFill = $('#progress-fill');
    const unlockBtn = $('#unlock-btn');

    // Hidden inputs
    const hiddenInputs = {
        experience: $('#experience'),
        goal: $('#goal'),
        days: $('#days'),
        equipment: $('#equipment'),
    };

    let currentStep = 1;
    const totalSteps = 3;

    // =============================================
    // ANIMATED STAT COUNTER
    // =============================================
    function animateCounters() {
        const counters = $$('[data-count]');
        counters.forEach((el) => {
            const target = parseInt(el.dataset.count, 10);
            const duration = 2000;
            const start = performance.now();

            function update(now) {
                const elapsed = now - start;
                const progress = Math.min(elapsed / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3);
                el.textContent = Math.floor(eased * target).toLocaleString();
                if (progress < 1) requestAnimationFrame(update);
            }

            requestAnimationFrame(update);
        });
    }

    // Run on load
    animateCounters();

    // =============================================
    // OPTION CARD SELECTION
    // =============================================
    function setupOptionCards(containerId, hiddenInput) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const buttons = container.querySelectorAll('.option-card');

        buttons.forEach((btn) => {
            btn.addEventListener('click', () => {
                buttons.forEach((b) => b.classList.remove('selected'));
                btn.classList.add('selected');
                hiddenInput.value = btn.dataset.value;
            });
        });
    }

    setupOptionCards('experience-options', hiddenInputs.experience);
    setupOptionCards('goal-options', hiddenInputs.goal);
    setupOptionCards('equipment-options', hiddenInputs.equipment);

    // Days Selector
    const dayBtns = $$('.day-btn');
    dayBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            dayBtns.forEach((b) => b.classList.remove('selected'));
            btn.classList.add('selected');
            hiddenInputs.days.value = btn.dataset.value;
        });
    });

    // =============================================
    // MULTI-STEP NAVIGATION
    // =============================================
    function goToStep(step) {
        // Validate current step before advancing
        if (step > currentStep && !validateStep(currentStep)) return;

        currentStep = step;

        // Update steps visibility
        $$('.form-step').forEach((s) => {
            s.classList.remove('active');
            if (parseInt(s.dataset.step) === step) s.classList.add('active');
        });

        // Update progress
        progressFill.style.width = `${(step / totalSteps) * 100}%`;

        // Update progress step labels
        $$('.progress-step').forEach((ps) => {
            const psStep = parseInt(ps.dataset.step);
            ps.classList.remove('active', 'completed');
            if (psStep === step) ps.classList.add('active');
            if (psStep < step) ps.classList.add('completed');
        });

        // Scroll form into view
        formWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Next buttons
    $$('.form-next').forEach((btn) => {
        btn.addEventListener('click', () => {
            const next = parseInt(btn.dataset.next);
            goToStep(next);
        });
    });

    // Back buttons
    $$('.form-prev').forEach((btn) => {
        btn.addEventListener('click', () => {
            const prev = parseInt(btn.dataset.prev);
            goToStep(prev);
        });
    });

    // =============================================
    // VALIDATION
    // =============================================
    function validateStep(step) {
        if (step === 1) {
            const email = $('#email');
            const emailError = $('#email-error');
            if (!email.value || !isValidEmail(email.value)) {
                email.classList.add('error');
                emailError.classList.add('visible');
                email.focus();
                return false;
            }
            email.classList.remove('error');
            emailError.classList.remove('visible');
            return true;
        }
        return true;
    }

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    // Remove error state on input
    $('#email').addEventListener('input', function () {
        this.classList.remove('error');
        $('#email-error').classList.remove('visible');
    });

    // =============================================
    // FORM SUBMISSION
    // =============================================
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!validateStep(currentStep)) return;

        const payload = {
            name: $('#name').value.trim(),
            email: $('#email').value.trim(),
            goal: hiddenInputs.goal.value,
            days: hiddenInputs.days.value,
            experience: hiddenInputs.experience.value,
            equipment: hiddenInputs.equipment.value,
            injuries: $('#injuries').value.trim(),
        };

        // Show loading screen
        formSection.classList.add('hidden');
        document.getElementById('hero').classList.add('hidden');
        document.getElementById('how-it-works').classList.add('hidden');
        document.getElementById('testimonials').classList.add('hidden');
        loadingScreen.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Animate loading steps
        animateLoadingSteps();

        try {
            const response = await fetch(CONFIG.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            // Wait for loading animation to finish
            await delay(4500);

            // Inject preview from webhook response
            // Webhook returns: { goal_summary: "...", weekly_split: [{day, focus}] }
            $('#preview-goal-summary').innerHTML =
                `<p class="goal-summary-text">${result.goal_summary}</p>`;

            let splitHTML = '';
            result.weekly_split.forEach(day => {
                splitHTML += `
                    <div class="split-day">
                        <span class="day-label">${day.day}</span>
                        <span class="day-focus">${day.focus}</span>
                    </div>`;
            });
            $('#preview-weekly-split').innerHTML = splitHTML;

            // Show preview
            loadingScreen.classList.add('hidden');
            previewSection.classList.remove('hidden');
            window.scrollTo({ top: 0, behavior: 'smooth' });

        } catch (error) {
            console.warn('Webhook unavailable, generating local preview:', error);

            // Generate fallback preview from form data
            const fallback = generateLocalPreview(payload);
            await delay(4500);

            $('#preview-goal-summary').innerHTML =
                `<p class="goal-summary-text">${fallback.goal_summary}</p>`;

            let splitHTML = '';
            fallback.weekly_split.forEach(day => {
                splitHTML += `
                    <div class="split-day">
                        <span class="day-label">${day.day}</span>
                        <span class="day-focus">${day.focus}</span>
                    </div>`;
            });
            $('#preview-weekly-split').innerHTML = splitHTML;

            loadingScreen.classList.add('hidden');
            previewSection.classList.remove('hidden');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    // =============================================
    // LOADING ANIMATION
    // =============================================
    function animateLoadingSteps() {
        const steps = ['ls-1', 'ls-2', 'ls-3', 'ls-4'];
        steps.forEach((id, i) => {
            const el = document.getElementById(id);
            el.classList.remove('active', 'completed');
        });

        steps.forEach((id, i) => {
            setTimeout(() => {
                const el = document.getElementById(id);
                el.classList.add('active');
                if (i > 0) {
                    document.getElementById(steps[i - 1]).classList.remove('active');
                    document.getElementById(steps[i - 1]).classList.add('completed');
                }
            }, i * 1100);
        });

        // Complete last step
        setTimeout(() => {
            document.getElementById(steps[steps.length - 1]).classList.remove('active');
            document.getElementById(steps[steps.length - 1]).classList.add('completed');
        }, steps.length * 1100);
    }


    // =============================================
    // LOCAL PREVIEW FALLBACK
    // =============================================
    function generateLocalPreview(payload) {
        const goalText = capitalize(payload.goal || 'General Fitness');
        const expText = capitalize(payload.experience || 'Intermediate');
        const equipText = capitalize(payload.equipment || 'Full Gym');
        const daysText = payload.days || '4';

        return {
            goal_summary: `Your personalized ${goalText} program is designed for an ${expText.toLowerCase()} trainee training ${daysText} days per week with ${equipText.toLowerCase()} access. This plan is optimized to maximize your results based on your profile.`,
            weekly_split: generateSplit(payload),
        };
    }

    function generateSplit(payload) {
        const days = parseInt(payload.days) || 4;
        const goal = (payload.goal || '').toLowerCase();

        const splits = {
            'fat loss': {
                2: [
                    { day: 'Day 1', focus: 'Full Body HIIT + Strength' },
                    { day: 'Day 2', focus: 'Full Body Metabolic Circuit' },
                ],
                3: [
                    { day: 'Day 1', focus: 'Upper Body + HIIT Finisher' },
                    { day: 'Day 2', focus: 'Lower Body + Core' },
                    { day: 'Day 3', focus: 'Full Body Metabolic Circuit' },
                ],
                4: [
                    { day: 'Day 1', focus: 'Upper Body Push + HIIT' },
                    { day: 'Day 2', focus: 'Lower Body Strength' },
                    { day: 'Day 3', focus: 'Upper Body Pull + Core' },
                    { day: 'Day 4', focus: 'Lower Body + Conditioning' },
                ],
                5: [
                    { day: 'Day 1', focus: 'Push + HIIT' },
                    { day: 'Day 2', focus: 'Legs – Quads & Glutes' },
                    { day: 'Day 3', focus: 'Pull + Core' },
                    { day: 'Day 4', focus: 'Legs – Hamstrings & Calves' },
                    { day: 'Day 5', focus: 'Full Body Conditioning' },
                ],
                6: [
                    { day: 'Day 1', focus: 'Push Strength' },
                    { day: 'Day 2', focus: 'Legs – Power' },
                    { day: 'Day 3', focus: 'Pull + HIIT' },
                    { day: 'Day 4', focus: 'Upper Body Hypertrophy' },
                    { day: 'Day 5', focus: 'Legs – Endurance' },
                    { day: 'Day 6', focus: 'Full Body Circuit' },
                ],
            },
            'muscle gain': {
                2: [
                    { day: 'Day 1', focus: 'Upper Body Hypertrophy' },
                    { day: 'Day 2', focus: 'Lower Body Hypertrophy' },
                ],
                3: [
                    { day: 'Day 1', focus: 'Push (Chest, Shoulders, Triceps)' },
                    { day: 'Day 2', focus: 'Pull (Back, Biceps)' },
                    { day: 'Day 3', focus: 'Legs (Quads, Hams, Glutes)' },
                ],
                4: [
                    { day: 'Day 1', focus: 'Upper Body – Strength' },
                    { day: 'Day 2', focus: 'Lower Body – Strength' },
                    { day: 'Day 3', focus: 'Upper Body – Hypertrophy' },
                    { day: 'Day 4', focus: 'Lower Body – Hypertrophy' },
                ],
                5: [
                    { day: 'Day 1', focus: 'Chest & Triceps' },
                    { day: 'Day 2', focus: 'Back & Biceps' },
                    { day: 'Day 3', focus: 'Legs – Quads Focus' },
                    { day: 'Day 4', focus: 'Shoulders & Arms' },
                    { day: 'Day 5', focus: 'Legs – Posterior Chain' },
                ],
                6: [
                    { day: 'Day 1', focus: 'Chest' },
                    { day: 'Day 2', focus: 'Back' },
                    { day: 'Day 3', focus: 'Legs – Quads' },
                    { day: 'Day 4', focus: 'Shoulders' },
                    { day: 'Day 5', focus: 'Arms (Biceps & Triceps)' },
                    { day: 'Day 6', focus: 'Legs – Hamstrings & Glutes' },
                ],
            },
            strength: {
                2: [
                    { day: 'Day 1', focus: 'Squat & Bench Focus' },
                    { day: 'Day 2', focus: 'Deadlift & OHP Focus' },
                ],
                3: [
                    { day: 'Day 1', focus: 'Squat + Accessories' },
                    { day: 'Day 2', focus: 'Bench Press + Accessories' },
                    { day: 'Day 3', focus: 'Deadlift + OHP + Accessories' },
                ],
                4: [
                    { day: 'Day 1', focus: 'Heavy Squat Day' },
                    { day: 'Day 2', focus: 'Heavy Bench Day' },
                    { day: 'Day 3', focus: 'Heavy Deadlift Day' },
                    { day: 'Day 4', focus: 'Volume Overhead Press' },
                ],
                5: [
                    { day: 'Day 1', focus: 'Heavy Squat' },
                    { day: 'Day 2', focus: 'Heavy Bench' },
                    { day: 'Day 3', focus: 'Heavy Deadlift' },
                    { day: 'Day 4', focus: 'Volume Squat + Bench' },
                    { day: 'Day 5', focus: 'Volume Deadlift + OHP' },
                ],
                6: [
                    { day: 'Day 1', focus: 'Heavy Squat' },
                    { day: 'Day 2', focus: 'Heavy Bench' },
                    { day: 'Day 3', focus: 'Heavy Deadlift' },
                    { day: 'Day 4', focus: 'Speed Squat + Accessories' },
                    { day: 'Day 5', focus: 'Speed Bench + Accessories' },
                    { day: 'Day 6', focus: 'Speed Pulls + Conditioning' },
                ],
            },
            'general fitness': {
                2: [
                    { day: 'Day 1', focus: 'Full Body Strength' },
                    { day: 'Day 2', focus: 'Full Body + Cardio' },
                ],
                3: [
                    { day: 'Day 1', focus: 'Upper Body + Core' },
                    { day: 'Day 2', focus: 'Lower Body + Mobility' },
                    { day: 'Day 3', focus: 'Full Body + Conditioning' },
                ],
                4: [
                    { day: 'Day 1', focus: 'Upper Body Strength' },
                    { day: 'Day 2', focus: 'Lower Body Strength' },
                    { day: 'Day 3', focus: 'Cardio + Core' },
                    { day: 'Day 4', focus: 'Full Body Functional' },
                ],
                5: [
                    { day: 'Day 1', focus: 'Push + Core' },
                    { day: 'Day 2', focus: 'Pull + Cardio' },
                    { day: 'Day 3', focus: 'Legs' },
                    { day: 'Day 4', focus: 'Upper Body Endurance' },
                    { day: 'Day 5', focus: 'Full Body + Mobility' },
                ],
                6: [
                    { day: 'Day 1', focus: 'Push Strength' },
                    { day: 'Day 2', focus: 'Pull Strength' },
                    { day: 'Day 3', focus: 'Legs' },
                    { day: 'Day 4', focus: 'HIIT + Core' },
                    { day: 'Day 5', focus: 'Upper Body Volume' },
                    { day: 'Day 6', focus: 'Active Recovery + Mobility' },
                ],
            },
        };

        const goalSplits = splits[goal] || splits['general fitness'];
        return goalSplits[days] || goalSplits[4];
    }

    // =============================================
    // PAYPAL CHECKOUT
    // =============================================
    if (unlockBtn) {
        unlockBtn.addEventListener('click', () => {
            // Redirect to PayPal payment link
            window.location.href = CONFIG.paypalCheckoutUrl;
        });
    }

    // =============================================
    // UTILITIES
    // =============================================
    function capitalize(str) {
        return str
            .split(' ')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
    }

    function delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    // =============================================
    // NAVBAR SCROLL EFFECT
    // =============================================
    let lastScroll = 0;
    window.addEventListener('scroll', () => {
        const navbar = $('#navbar');
        if (!navbar) return;
        const scrollY = window.scrollY;

        if (scrollY > 50) {
            navbar.style.background = 'rgba(10, 10, 15, 0.92)';
            navbar.style.borderBottomColor = 'rgba(255,255,255,0.08)';
        } else {
            navbar.style.background = 'rgba(10, 10, 15, 0.7)';
            navbar.style.borderBottomColor = 'rgba(255,255,255,0.06)';
        }

        lastScroll = scrollY;
    });

    // =============================================
    // INTERSECTION OBSERVER FOR ANIMATIONS
    // =============================================
    const observerOptions = {
        threshold: 0.15,
        rootMargin: '0px 0px -50px 0px',
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.style.animation = 'fadeInUp 0.6s ease-out forwards';
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe elements
    $$('.step-card, .testimonial-card').forEach((el) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        observer.observe(el);
    });
    // =============================================
    // CONTACT MODAL
    // =============================================
    const contactTrigger = document.getElementById('contact-trigger');
    const contactModal = document.getElementById('contact-modal');
    const modalClose = document.getElementById('modal-close');

    if (contactTrigger && contactModal) {
        contactTrigger.addEventListener('click', (e) => {
            e.preventDefault();
            contactModal.classList.remove('hidden');
        });

        modalClose.addEventListener('click', () => {
            contactModal.classList.add('hidden');
        });

        // Close on backdrop click
        contactModal.addEventListener('click', (e) => {
            if (e.target === contactModal) {
                contactModal.classList.add('hidden');
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !contactModal.classList.contains('hidden')) {
                contactModal.classList.add('hidden');
            }
        });
    }

})();
