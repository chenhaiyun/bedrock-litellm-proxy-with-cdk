# Use an official Python runtime as a parent image
FROM python:3.12

# Set the working directory in the container
WORKDIR /app

# Copy the current directory contents into the container at /app
COPY . /app

# Install dependencies
RUN pip install --no-cache-dir 'litellm[proxy]' boto3 openai

# (可选) 复制并声明 .env 文件中的变量
# 如果你需要在运行时使用 .env 内容，推荐在 ENTRYPOINT 或 CMD 中加载
# 比如使用 `dotenv` 库在代码中加载，或在 shell 启动脚本中 source .env

# Expose the port that your FastAPI application will run on
EXPOSE 8080

# Define the command to run your application
RUN chmod +x start.sh
CMD ["./start.sh"]
