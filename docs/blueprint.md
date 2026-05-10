# **App Name**: Mobile CodeForge

## Core Features:

- GitHub Repository Browser: Browse and navigate code repositories directly from GitHub within the application's interface.
- Code Editor & AI Chat Split View: A responsive user interface with a 6:4 vertical split, featuring a code editor in the top section and an integrated AI chat interface at the bottom.
- Secure Client Credential Storage: A robust mechanism for securely storing GitHub authentication tokens on the client device.
- Natural Language Instruction Processing: Process natural language instructions from users to identify target code segments and describe desired modifications to an intelligent LLM tool.
- Intelligent LLM Selection: A system that intelligently selects and interfaces with the optimal LLM tool (Gemma 4, Gemini, Qwen, Groq, Mistral) for specific coding tasks based on inferred requirements.
- Real-time AI Processing Feedback: Display real-time status updates (e.g., 'Qwen 3.5 is reasoning...') to inform the user about the AI's processing state.
- Automated GitHub Commits: Facilitate direct pushing of AI-generated code changes as new commits to the specified GitHub repository via the GitHub API.

## Style Guidelines:

- Primary interactive color: A refined technical blue, #4696E6. This hue is chosen for its clarity and association with technology, providing a vibrant contrast on the dark interface without being overly dominant.
- Background color: A deep, professional dark grey, #1e1e1e. This foundational color ensures a sleek, focused environment, aligning with professional coding tools and reducing eye strain.
- Accent color: A subtle, dynamic violet, #937AFF. This analogous hue adds an intelligent accent to calls-to-action and key indicators, providing visual depth and sophisticated emphasis.
- Headline font: 'Space Grotesk' (sans-serif) for its modern, slightly techy aesthetic, perfectly suited for titles and prominent text elements. Body font: 'Inter' (sans-serif) for its excellent legibility and neutral, objective character, ensuring comfortable reading of code, chat, and detailed descriptions. Code font: 'Source Code Pro' (monospace) for pristine display of programming code snippets.
- Utilize minimalist, line-based icons that complement the dark theme and clean layout. Icons should clearly convey function and blend seamlessly with both code-related and chat elements.
- The primary screen layout features a fixed 60/40 vertical split, with the code editor occupying the upper 60% and the AI chat interface the lower 40%, optimizing for mobile code interaction. Key information is hierarchically structured for immediate understanding.
- Implement subtle and purposeful animations, especially for state changes in the AI chat (e.g., 'reasoning...') and seamless transitions between file views to enhance user feedback and overall experience.