function toggleTheme() {
  var html = document.documentElement;
  var next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
}

function toggleSkill(header) {
  const content = header.nextElementSibling;
  const icon = header.querySelector('.skill-icon');
  const isOpen = content.classList.contains('active');
 
  document.querySelectorAll('.skill-content.active').forEach(el => {
    el.classList.remove('active');
    el.previousElementSibling.querySelector('.skill-icon').style.transform = 'rotate(0deg)';
  });
 
  if (!isOpen) {
    content.classList.add('active');
    icon.style.transform = 'rotate(180deg)';
  }
}
 
function toggleProject(header) {
  const content = header.nextElementSibling;
  const icon = header.querySelector('.skill-icon');
  const isOpen = content.classList.contains('active');
 
  document.querySelectorAll('.project-content.active').forEach(el => {
    el.classList.remove('active');
    el.previousElementSibling.querySelector('.skill-icon').style.transform = 'rotate(0deg)';
  });
 
  if (!isOpen) {
    content.classList.add('active');
    icon.style.transform = 'rotate(180deg)';
  }
}
 
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.08 });
 
document.querySelectorAll('.timeline-item, .passion-card, .project-item, .skill-category').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(16px)';
  el.style.transition = 'opacity .5s ease, transform .5s ease';
  observer.observe(el);
});