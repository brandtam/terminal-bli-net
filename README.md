# ChatrBot.ai

A basic chatbot that can be used to answer questions in different moods for fun.

## What it does

In practice, the chatbot can be used to answer questions in different moods. The idea is to show that the responses can be different depending on the mood of the chatbot.

---

## Install the project

- Clone the project onto your local machine

```bash
git clone https://github.com/brandtam/sk-chatr-bot.git
```

- Install the packages with your favorite package manager (pnpm)

```bash
pnpm install
```

## Setup the OpenAI API

- Create an account on [OpenAI](https://platform.openai.com/)
- Create an API key
- Create a `.env` file in the root of the project
- Add your API key to the `.env` file as follows:

```bash
OPENAI_KEY=your_api_key_that_you_copied_from_openai
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

- Start the server locally

```bash
pnpm dev
```

## Building

To create a production version of your app:

```bash
pnpm run build
```

## Deploying to Production

Since this specific app uses Vercel Edge Functions you will need to deploy to [Vercel](https://www.vercel.com).

- Copy the OpenAi API key to the projects environment variables on Vercel.

## License

[MIT](LICENSE.md)
