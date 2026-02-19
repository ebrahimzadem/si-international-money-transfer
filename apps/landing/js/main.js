(function () {
  'use strict';

  // ─── NAVBAR SCROLL EFFECT ─────────────────────────────────────────
  var navbar = document.getElementById('navbar');
  var scrollThreshold = 40;

  function handleScroll() {
    if (window.scrollY > scrollThreshold) {
      navbar.classList.add('navbar--scrolled');
    } else {
      navbar.classList.remove('navbar--scrolled');
    }
  }

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();

  // ─── MOBILE HAMBURGER TOGGLE ──────────────────────────────────────
  var hamburger = document.getElementById('hamburger');
  var navLinks = document.getElementById('navLinks');

  hamburger.addEventListener('click', function () {
    hamburger.classList.toggle('active');
    navLinks.classList.toggle('active');
  });

  // Close mobile nav when a link is clicked
  var links = navLinks.querySelectorAll('.navbar__link');
  for (var i = 0; i < links.length; i++) {
    links[i].addEventListener('click', function () {
      hamburger.classList.remove('active');
      navLinks.classList.remove('active');
    });
  }

  // ─── SMOOTH SCROLL FOR ANCHOR LINKS ──────────────────────────────
  var anchors = document.querySelectorAll('a[href^="#"]');
  for (var j = 0; j < anchors.length; j++) {
    anchors[j].addEventListener('click', function (e) {
      var href = this.getAttribute('href');
      if (href === '#') return;

      var target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        var offset = navbar.offsetHeight + 16;
        var top = target.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top: top, behavior: 'smooth' });
      }
    });
  }

  // ─── SCROLL-TRIGGERED FADE-IN ANIMATIONS ─────────────────────────
  var fadeElements = document.querySelectorAll(
    '.step, .feature-card, .security__item, .trust-bar__item'
  );

  for (var k = 0; k < fadeElements.length; k++) {
    fadeElements[k].classList.add('fade-in');
  }

  function checkVisibility() {
    var windowHeight = window.innerHeight;
    for (var m = 0; m < fadeElements.length; m++) {
      var rect = fadeElements[m].getBoundingClientRect();
      if (rect.top < windowHeight - 80) {
        fadeElements[m].classList.add('visible');
      }
    }
  }

  window.addEventListener('scroll', checkVisibility, { passive: true });
  window.addEventListener('resize', checkVisibility, { passive: true });
  setTimeout(checkVisibility, 100);
})();
