# ChatrBot.ai

A basic chatbot that can be used to answer questions about in different moods for fun.

## What it does

In practice, the chatbot can be used to answer questions in different moods. The idea is to show that the responses can be different depending on the mood of the chatbot.

## Install the project

```bash
# clone the project onto your local machine
git clone https://github.com/brandtam/sk-chatr-bot.git

# install the packages with your favorite package manager (pnpm)
pnpm install
```

## Setup the OpenAI API

- Create an account on [OpenAI](https://platform.openai.com/)
- Create an API key
- Create a `.env` file in the root of the project
- Add the following to the `.env` file

```bash
OPENAI_KEY=your_api_key_that_you_copied_from_openai
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
# start the server locally
pnpm dev
```

## Building

To create a production version of your app:

```bash
pnpm run build
```

## Deploying to Production

To deploy your app, you may need to install an [adapter](https://kit.svelte.dev/docs#adapters) for your target environment.

- Copy the OpenAi API key to the server using the hosts secrets manager, or environment variables.

## License

tbd
