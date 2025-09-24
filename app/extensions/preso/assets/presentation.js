document.addEventListener("DOMContentLoaded", () => {
  const isPresenter = window.name === "preso-presenter";
  const channel = new BroadcastChannel("preso-sync-channel");
  let presenterWindow = null;

  let current = 0;
  let notesVisible = false;
  let overviewVisible = false;

  const slides = Array.from(document.querySelectorAll(".slide-wrapper"));
  const allNotes = Array.from(document.querySelectorAll(".notes-content"));
  const totalSlides = slides.length;

  // --- Core Functions ---
  const showNotesForSlide = (index) => {
    allNotes.forEach((el, i) => {
      el.style.display = i === index ? "block" : "none";
    });
  };

  const showSlide = (index) => {
    current = (index + totalSlides) % totalSlides;
    slides.forEach((s, i) => s.classList.toggle("active", i === current));
    if (notesVisible) showNotesForSlide(current);
    if (!isPresenter) broadcastState();
  };

  const broadcastState = () => {
    if (isPresenter || !presenterWindow || presenterWindow.closed) return;

    const prevIndex = (current - 1 + totalSlides) % totalSlides;
    const nextIndex = (current + 1) % totalSlides;

    const message = {
      type: "state-update",
      currentIndex: current,
      currentSlideHtml: slides[current].innerHTML,
      prevSlideHtml: slides[prevIndex].innerHTML,
      nextSlideHtml: slides[nextIndex].innerHTML,
      currentNotesHtml: allNotes[current].innerHTML,
    };
    channel.postMessage(message);
  };

  // --- Event Handlers & Logic ---
  channel.onmessage = (event) => {
    const msg = event.data;
    if (isPresenter) return;

    if (msg.type === "command") {
      if (msg.action === "next") showSlide(current + 1);
      else if (msg.action === "prev") showSlide(current - 1);
      else if (msg.action === "presenter-ready") {
        presenterWindow = window.open("", "preso-presenter");
        broadcastState();
      } else if (msg.action === "presenter-closing") {
        presenterWindow = null;
      }
    }
  };

  if (isPresenter) {
    // --- Presenter Window Logic ---
    document.getElementById("main-view").style.display = "none";
    document.getElementById("presenter-view").style.display = "flex";

    const currentHost = document.getElementById("presenter-current-slide");
    const nextHost = document.getElementById("presenter-next-slide");
    const prevHost = document.getElementById("presenter-prev-slide");
    const notesHost = document.getElementById("presenter-notes");

    document.getElementById("presenter-next-btn").onclick = () =>
      channel.postMessage({ type: "command", action: "next" });
    document.getElementById("presenter-prev-btn").onclick = () =>
      channel.postMessage({ type: "command", action: "prev" });

    document.addEventListener("keydown", (e) => {
      if (
        e.key === "ArrowRight" ||
        e.key === " " ||
        e.key === "ArrowDown" ||
        e.key === "PageDown"
      ) {
        e.preventDefault();
        channel.postMessage({ type: "command", action: "next" });
      } else if (
        e.key === "ArrowLeft" ||
        e.key === "ArrowUp" ||
        e.key === "PageUp"
      ) {
        e.preventDefault();
        channel.postMessage({ type: "command", action: "prev" });
      }
    });

    channel.onmessage = (event) => {
      const msg = event.data;
      if (msg.type !== "state-update") return;
      currentHost.innerHTML = msg.currentSlideHtml;
      nextHost.innerHTML = msg.nextSlideHtml;
      prevHost.innerHTML = msg.prevSlideHtml;
      notesHost.innerHTML = msg.currentNotesHtml;
    };

    window.addEventListener("beforeunload", () =>
      channel.postMessage({ type: "command", action: "presenter-closing" }),
    );
    setTimeout(
      () => channel.postMessage({ type: "command", action: "presenter-ready" }),
      200,
    );
  } else {
    // --- Main Window Logic ---
    document.addEventListener("keydown", (e) => {
      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        if (!presenterWindow || presenterWindow.closed) {
          presenterWindow = window.open(
            window.location.href,
            "preso-presenter",
            "width=1200,height=800,menubar=no,toolbar=no,location=no,status=no",
          );
        } else {
          presenterWindow.focus();
        }
      } else if (
        e.key === "ArrowRight" ||
        e.key === " " ||
        e.key === "ArrowDown" ||
        e.key === "PageDown"
      )
        showSlide(current + 1);
      else if (
        e.key === "ArrowLeft" ||
        e.key === "ArrowUp" ||
        e.key === "PageUp"
      )
        showSlide(current - 1);
    });

    document.body.addEventListener("click", (e) => {
      const navTarget = e.target.closest(".nav-label");
      const miniSlideTarget = e.target.closest(".mini-slide-wrapper");
      if (!navTarget && !miniSlideTarget) {
        showSlide(current + 1); // Next slide on click anywhere that is not a button
        return;
      }
      if (navTarget) {
        if (navTarget.classList.contains("next")) showSlide(current + 1);
        else if (navTarget.classList.contains("prev")) showSlide(current - 1);
        else if (navTarget.classList.contains("notes-toggle")) {
          notesVisible = !notesVisible;
          document.body.classList.toggle("notes-visible", notesVisible);
          if (notesVisible) showNotesForSlide(current);
        } else if (navTarget.classList.contains("overview-toggle")) {
          overviewVisible = !overviewVisible;
          document.body.classList.toggle("overview-visible", overviewVisible);
        }
      } else if (miniSlideTarget) {
        const index = parseInt(miniSlideTarget.dataset.slideIndex, 10);
        if (!isNaN(index)) showSlide(index);
      }
    });

    window.addEventListener("beforeunload", () => {
      if (presenterWindow && !presenterWindow.closed) presenterWindow.close();
    });
    showSlide(0);
  }
});
