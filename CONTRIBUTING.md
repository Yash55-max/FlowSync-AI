# Contributing to FlowSync AI

Thank you for your interest in contributing to FlowSync AI! We welcome contributions from the community. This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful, inclusive, and professional in all interactions. We are committed to providing a welcoming and harassment-free environment.

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/Yash55-max/FlowSync-AI.git
   cd FlowSync-AI
   ```
3. **Create** a new branch for your feature:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Setup

### Backend Development
```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .\.venv\Scripts\Activate.ps1

# Install dependencies
cd backend
pip install -r requirements.txt

# Run with auto-reload
python -m uvicorn app.main:app --reload --port 8000
```

### Frontend Development
```bash
cd frontend
npm install
npm run dev
```

## Making Changes

### Code Style

**Python (Backend)**
- Follow PEP 8 style guidelines
- Use type hints for function signatures
- Write docstrings for public functions and classes
- Max line length: 100 characters

**TypeScript/React (Frontend)**
- Use ESLint and Prettier configurations
- Components should be functional with hooks
- Props should have TypeScript interfaces
- Write descriptive component comments

### Commit Messages
- Use present tense: "Add feature" not "Added feature"
- Be descriptive but concise
- Reference issues when relevant: "Fix #123"
- Example: `feat: add real-time notifications for queue changes`

### Testing

Before submitting:
- **Backend**: Verify all endpoints work with sample requests
- **Frontend**: Test build succeeds (`npm run build`)
- Test responsive design on mobile viewports
- Check console for errors and warnings

## Submitting Changes

1. **Push** your branch to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create** a Pull Request on GitHub with:
   - Clear title describing the feature/fix
   - Description of changes and motivation
   - Links to relevant issues
   - Screenshots for UI changes
   - Any breaking changes clearly marked

3. **Respond** to review comments and requested changes

## Areas for Contribution

### Backend
- Algorithm improvements for route optimization
- Performance optimizations
- Additional API endpoints
- Better error handling
- Database efficiency improvements

### Frontend
- UI/UX improvements
- Accessibility enhancements
- Performance optimization
- New visualization types
- Mobile responsiveness

### Documentation
- API documentation improvements
- Setup guides for different platforms
- Architecture documentation
- Tutorial videos or screenshots

## Questions?

- Check existing issues for Q&A
- Create a GitHub Discussion for questions
- Open an issue for bugs or feature requests

## Recognition

Contributors will be recognized in:
- Release notes for significant contributions
- README acknowledgments section
- GitHub contributors page

Thank you for contributing to FlowSync AI! 🙏
