(() => {
    function createModes(modeList) {
        const modesCollection = {
            modes: {},
            modeStatus: {},
            onChangeHandlers: {},
            isMode(mode) {
                return Boolean(this.modeStatus[mode]);
            },
            setMode(mode = null, value = true) {

                const newValue = mode ? Boolean(value) : false;

                if (mode) {
                    const oldValue = this.modeStatus[mode];

                    this.modeStatus[mode] = newValue;

                    this.onChangeHandlers[mode].forEach((callback) => callback(newValue, oldValue));
                } else {
                    Object.keys(this.modeStatus).forEach((key) => {
                        const oldValue = this.modeStatus[key];
                        this.modeStatus[key] = newValue
                        this.onChangeHandlers[key].forEach((callback) => callback(newValue, oldValue));
                    });
                }
            },
            onModeChange(mode = null, callback) {
                if (this.onChangeHandlers[mode]) {
                    callback && this.onChangeHandlers[mode].push(callback);
                }
            }
        }

        Array.from(new Set(modeList)).forEach((key) => {
            modesCollection.modes[key] = key;
            modesCollection.modeStatus[key] = false;
            modesCollection.onChangeHandlers[key] = [];
        });

        return {
            modes: modesCollection.modes,
            isMode: modesCollection.isMode.bind(modesCollection),
            setMode: modesCollection.setMode.bind(modesCollection),
            onModeChange: modesCollection.onModeChange.bind(modesCollection),
        };
    }

    const { modes, isMode, setMode, onModeChange } = createModes([
        "ADDING_KEYFRAME",
        "PLAYING_ANIMATION"
    ]);

    const ANIMATION_STORE = {
        name: "my-animation",
        keyframes: {
            0: { "font-size": "100px" },
            50: { "font-size": "60px" },
            100: { "font-size": "100px" }
        }
    };

    let CURRENT_SELECTED_MARKER = null;
    let ZERO_KEYFRAME_MARKER = null;
    let CURRENT_SELECTED_KEYFRAME = null;
    let ANIMATION_KEYFRAME_STEP = 0;
    let ANIMATION_STYLE_TAG_ELEMENT = null;

    const cssCodeModal = new mdb.Modal(document.getElementById("app-css-code-modal"));
    const getCssCodeButton = document.getElementById("app-get-css-code-button");
    const cssCodeTextarea = document.getElementById("app-css-code-textarea");
    const cssCodeCopyButton = document.getElementById("app-css-code-copy-button");
    const mainAppFormSection = document.getElementById("app-form");
    const formCurrentSelectedKeyframeText = document.getElementById("app-form-current-selected-keyframe");
    const targetElement = document.getElementById("target-element");
    const timeline = document.getElementById("timeline");
    const timelineMarkerNew = document.getElementById("timeline-marker-new");
    const timelineMarkerNewText = timelineMarkerNew.querySelector("span")
    const addAnimationKeyframeButton = document.getElementById("add-animation-step-button");
    const cancelAnimationKeyframeButton = document.getElementById("cancel-animation-step-button");
    const deleteAnimationKeyframeButton = document.getElementById("delete-animation-step-button");
    const playAnimationKeyframeButton = document.getElementById("play-animation-button");
    const stopAnimationKeyframeButton = document.getElementById("stop-animation-button");
    const formInputCollection = Array.from(mainAppFormSection.querySelectorAll("[data-app-animation-input]")).map((input) => {
        const inputType = input.getAttribute("data-app-animation-input");
        const inputProperty = input.getAttribute("data-app-animation-input-property");
        const inputValueString = input.getAttribute("data-app-animation-input-value-string");
        const inputDefaultValue = input.getAttribute("data-app-animation-input-default");

        return { 
            input, 
            inputType,
            inputProperty,
            inputValueString,
            inputDefaultValue,
        }
    });

    function storeAnimationKeyframe(keyframe) {
        if (!ANIMATION_STORE.keyframes[keyframe]) {
            ANIMATION_STORE.keyframes[keyframe] = {};
        }
    }

    function showNewMarkerPreview() {
        timelineMarkerNew.style.left = `${ANIMATION_KEYFRAME_STEP}%`;
        timelineMarkerNewText.innerText = `${Math.round(ANIMATION_KEYFRAME_STEP)}`
    }

    function hideNewMarkerPreview() {
        timelineMarkerNew.style.left = "-200%";
        timelineMarkerNewText.innerText = 0;
    }

    function createMarker(step) {
        const roundedStep = Math.round(step);
        const marker = document.createElement("div");
        marker.className = "app-timeline-marker step";
        marker.style.left = `${step}%`;

        const stepText = document.createElement("span");
        stepText.innerText = roundedStep;

        marker.appendChild(stepText);
        timeline.appendChild(marker);

        return marker;
    }

    function createAnimationKeyframe(step) {
        const marker = createMarker(step);
        const roundedStep = Math.round(step);

        marker.addEventListener("click", () => {
            selectAnimationKeyframeMarker(marker, roundedStep)
        });

        storeAnimationKeyframe(roundedStep);

        return marker;
    }

    function calculateAnimationKeyframe(event) {
        let offset = event.pageX - event.target.offsetLeft;
        let result = ((offset / event.target.offsetWidth) * 100).toFixed(1);

        ANIMATION_KEYFRAME_STEP = result;
    }

    function resetAnimationKeyframeStep() {
        ANIMATION_KEYFRAME_STEP = 0;
    }

    function renderDeleteAnimationKeyframeButton() {
        if (!isMode(modes.ADDING_KEYFRAME) && CURRENT_SELECTED_MARKER && CURRENT_SELECTED_KEYFRAME != 0) {
            deleteAnimationKeyframeButton.innerText = `Delete ${CURRENT_SELECTED_KEYFRAME}%`;
            deleteAnimationKeyframeButton.style.display = "initial";
        } else {
            deleteAnimationKeyframeButton.style.display = "none";
        }
    }

    function startAddingAnimationKeyframe() {
        if (isMode(modes.PLAYING_ANIMATION)) stopAnimation();

        setMode(modes.ADDING_KEYFRAME);
        addAnimationKeyframeButton.style.display = "none";
        cancelAnimationKeyframeButton.style.display = "initial";

        renderDeleteAnimationKeyframeButton();
    }

    function cancelAddingAnimationKeyframe() {
        setMode();
        hideNewMarkerPreview();
        resetAnimationKeyframeStep();

        addAnimationKeyframeButton.style.display = "initial";
        cancelAnimationKeyframeButton.style.display = "none";

        renderDeleteAnimationKeyframeButton();
    }

    function deleteAddingAnimationKeyframe() {
        if (isMode(modes.PLAYING_ANIMATION)) stopAnimation();

        setMode();

        removeAnimationKeyframeMarker();

        renderDeleteAnimationKeyframeButton();
    }

    function selectAnimationKeyframeMarker(marker, keyframe) {
        deselectAnimationKeyframeMarker();

        CURRENT_SELECTED_KEYFRAME = keyframe;
        CURRENT_SELECTED_MARKER = marker;
        CURRENT_SELECTED_MARKER.classList.replace("step", "current");

        renderDeleteAnimationKeyframeButton();

        onKeyframeChange();
    }

    function deselectAnimationKeyframeMarker() {
        CURRENT_SELECTED_MARKER?.classList?.replace("current", "step");
        CURRENT_SELECTED_MARKER = null;
        CURRENT_SELECTED_KEYFRAME = null;
    }

    function removeAnimationKeyframeMarker() {
        delete ANIMATION_STORE.keyframes[CURRENT_SELECTED_KEYFRAME];

        CURRENT_SELECTED_MARKER?.remove();

        selectAnimationKeyframeMarker(ZERO_KEYFRAME_MARKER, 0);
    }

    function onKeyframeChange() {
        formCurrentSelectedKeyframeText.textContent = CURRENT_SELECTED_KEYFRAME + "%";

        updateAnimationInputs();

        setAnimationPreviewOnTarget();
    }

    function setupAnimationKeyframes() {
        Object.keys(ANIMATION_STORE.keyframes).forEach((step) => {
            const marker = createAnimationKeyframe(step);

            if (step == 0) {
                ZERO_KEYFRAME_MARKER = marker;
                selectAnimationKeyframeMarker(marker, 0);
            }
        });
    }

    function loopThroughFormInputs(callback) {
        formInputCollection.forEach((inputOptions) => {
            callback(inputOptions);
        });
    }

    function setupAnimationInputFields() {
        loopThroughFormInputs((options) => {
            const { input, inputType, inputProperty, inputValueString } = options;

            input.addEventListener("input", (event) => {
                if (CURRENT_SELECTED_KEYFRAME != null) {
                    if (!ANIMATION_STORE.keyframes[CURRENT_SELECTED_KEYFRAME][inputType]) {
                        ANIMATION_STORE.keyframes[CURRENT_SELECTED_KEYFRAME][inputType] = {};
                    }

                    let value = event.target.value;

                    if (inputValueString) {
                        value = inputValueString.replace("{value}", value)
                    }

                    if (inputProperty) {
                        ANIMATION_STORE.keyframes[CURRENT_SELECTED_KEYFRAME][inputType][inputProperty] = value;
                    } else {
                        ANIMATION_STORE.keyframes[CURRENT_SELECTED_KEYFRAME][inputType] = value;
                    }

                    setAnimationPreviewOnTarget();
                }
            });
        });
    }

    function updateAnimationInputs() {
        if (CURRENT_SELECTED_KEYFRAME != null) {
            loopThroughFormInputs((options) => {
                const { input, inputType, inputProperty, inputDefaultValue } = options;

                if (!ANIMATION_STORE.keyframes[CURRENT_SELECTED_KEYFRAME][inputType]) {
                    ANIMATION_STORE.keyframes[CURRENT_SELECTED_KEYFRAME][inputType] = inputProperty ? {} : "";
                }

                if (inputProperty) {
                    input.value = ANIMATION_STORE.keyframes[CURRENT_SELECTED_KEYFRAME][inputType][inputProperty] || inputDefaultValue || "";
                } else {
                    input.value = ANIMATION_STORE.keyframes[CURRENT_SELECTED_KEYFRAME][inputType] || inputDefaultValue || "";
                }
            });
        }
    }

    function getKeyframeCssProperties(keyframe = 0) {
        const animationKeyframe = ANIMATION_STORE.keyframes[keyframe];

        if (!animationKeyframe) return {};

        const properties = Object.entries(animationKeyframe).reduce((acc, [property, value]) => {
            let shouldUpdate = true;

            switch (property) {
                case "transform": {
                    const transformProperties = value;
                    const rotate = transformProperties.rotate ? `rotate(${transformProperties.rotate}deg)` : "";
                    const scale = transformProperties.scale ? `scale(${transformProperties.scale})` : "";

                    const result = [rotate, scale].join(" ").trim();

                    if (result) {
                        value = result;
                    } else {
                        shouldUpdate = false
                    }

                    break;
                }
            }

            if (shouldUpdate) {
                acc[property] = value;
            }

            return acc;
        }, {})

        return properties;
    }

    function getKeyframeCssText(keyframe, options = {}) {
        const { prefix = "" } = options;

        const properties = getKeyframeCssProperties(keyframe);

        let cssText = Object.entries(properties).map(([property, value]) => value ? `${prefix}${property}: ${value}` : "").filter(Boolean).join(";\n");

        cssText = cssText ? cssText + ";" : "";

        return cssText;
    }

    function generateKeyframes() {
        const keyframeSelectors = Object.keys(ANIMATION_STORE.keyframes).reduce((acc, keyframe) => {
            const cssText = getKeyframeCssText(keyframe, { prefix: "\t \t" });

            if (cssText) {
                acc += `\n\t${keyframe}% {\n${cssText}\n\t}`;
            }

            return acc;
        }, "");

        const keyframes = `@keyframes ${ANIMATION_STORE.name} {${keyframeSelectors}\n}`;

        return keyframes;
    }

    function generateAnimationCss(options = {}) {
        const { targetElementSelector = "#target-element" } = options;

        const keyframesCss = generateKeyframes();

        const cssText = `${targetElementSelector} { \n\tanimation: ${ANIMATION_STORE.name} 3s ease 0s infinite normal none; \n}\n\n${keyframesCss}`;

        return cssText;
    }

    function setAnimationPreviewOnTarget() {
        const cssText = getKeyframeCssText(CURRENT_SELECTED_KEYFRAME);

        targetElement.style.cssText = cssText;
    }

    function removeAnimationPreviewFromTarget() {
        targetElement.style.cssText = "";
    }

    function playAnimation() {
        setMode(modes.PLAYING_ANIMATION);

        const cssText = generateAnimationCss();

        const styleTag = document.createElement('style');

        if (styleTag.styleSheet) {
            styleTag.styleSheet.cssText = cssText;
        } else {
            styleTag.appendChild(document.createTextNode(cssText));
        }

        ANIMATION_STYLE_TAG_ELEMENT = styleTag;

        document.body.appendChild(ANIMATION_STYLE_TAG_ELEMENT);

        removeAnimationPreviewFromTarget();

        playAnimationKeyframeButton.style.display = "none";
        stopAnimationKeyframeButton.style.display = "initial";
    }

    function stopAnimation() {
        setMode(modes.PLAYING_ANIMATION, false);

        setAnimationPreviewOnTarget();

        ANIMATION_STYLE_TAG_ELEMENT?.remove();

        playAnimationKeyframeButton.style.display = "initial";
        stopAnimationKeyframeButton.style.display = "none";
    }

    function onTimelineMouseMove(event) {
        if (isMode(modes.ADDING_KEYFRAME)) {
            if (event.target == timeline) {
                calculateAnimationKeyframe(event)
            }

            showNewMarkerPreview()
        }
    }

    function onTimelineMouseLeave(event) {
        if (isMode(modes.ADDING_KEYFRAME)) {
            hideNewMarkerPreview();
            resetAnimationKeyframeStep();
        }
    }

    function onTimelineMouseClick(event) {
        if (isMode(modes.ADDING_KEYFRAME)) {
            const marker = createAnimationKeyframe(ANIMATION_KEYFRAME_STEP);
            cancelAddingAnimationKeyframe();
            marker.click();
        }
    }

    function onGetCssButtonClick() {
        const cssText = generateAnimationCss();

        cssCodeTextarea.value = cssText

        cssCodeModal.show();
    }

    function onCssCodeCopyButtonClick() {
        const cssText = cssCodeTextarea.value;

        navigator.clipboard.writeText(cssText).then((result) => {
            cssCodeCopyButton.innerHTML = `<i class="fas fa-copy"></i> Copied to clipboard`
        }).catch((err) => {
            console.log("Unable to copy", err)
        }).finally(() => {
            setTimeout(() => {
                cssCodeCopyButton.innerHTML = `<i class="fas fa-copy"></i> Copy to clipboard`
            }, 1000)
        });
    }

    timeline.addEventListener("mousemove", onTimelineMouseMove);
    timeline.addEventListener("mouseleave", onTimelineMouseLeave);
    timeline.addEventListener("click", onTimelineMouseClick);

    addAnimationKeyframeButton.addEventListener('click', startAddingAnimationKeyframe);
    cancelAnimationKeyframeButton.addEventListener('click', cancelAddingAnimationKeyframe);
    deleteAnimationKeyframeButton.addEventListener('click', deleteAddingAnimationKeyframe);
    playAnimationKeyframeButton.addEventListener('click', playAnimation);
    stopAnimationKeyframeButton.addEventListener('click', stopAnimation);
    getCssCodeButton.addEventListener('click', onGetCssButtonClick);
    cssCodeCopyButton.addEventListener('click', onCssCodeCopyButtonClick);

    onModeChange(modes.PLAYING_ANIMATION, (value, previousValue) => {
        console.log("PLAYING ANIMATION", value)
    });

    setupAnimationInputFields();
    setupAnimationKeyframes();
})()