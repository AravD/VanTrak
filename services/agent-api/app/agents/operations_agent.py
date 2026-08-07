"""
The operations agent: a chat loop that can call tools to fetch real data.
We send the user's message + the menu of tools to the model. If the model asks
to call a tool, we run it, feed the result back, and ask again — looping until
the model replies with plain text instead of a tool call.
"""
#regular imports
import json

#same directory imports
from .prompts import build_system_prompt

#different directory imports
from ..auth import CurrentUser
from ..openai_client import get_openai_client
from ..tools.drivers import LIST_DRIVERS_TOOL, run_list_drivers
from ..tools.schedules import GET_SCHEDULE_TOOL, run_get_schedule

MODEL = "gemini-flash-latest"

#list out any new functions here
TOOLS = [LIST_DRIVERS_TOOL, GET_SCHEDULE_TOOL]

#runs the agent and connects the message to the LLM
def run_operations_agent(user: CurrentUser, message: str) -> str:
    
    client = get_openai_client()
    system_prompt = build_system_prompt()

  #conversation starting and append to message
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": message},
    ]

    #max loop of 5 for conversation
    for _ in range(5):
        response = client.chat.completions.create( # type: ignore
            model = MODEL,
            messages = messages,
            tools = TOOLS,
        )
        reply = response.choices[0].message

        #exiting loop
        if not reply.tool_calls:
            return reply.content or ""
        
        #after loop exited or final call done
        messages.append(reply)
        for call in reply.tool_calls:
            result = run_tool(user, call.function.name, call.function.arguments)
            messages.append({
                "role": "tool",
                "tool_call_id": call.id,
                "content": json.dumps(result),
            })

    return "Sorry, I could not complete that request."
        
#allows the agent to run certain tools and recieve information/data
def run_tool(user: CurrentUser, name: str, arguments_json: str):
    
    #Send a tool call, by name, to the matching Python function
    args = json.loads(arguments_json or "{}")

    if name == "list_drivers":
        return run_list_drivers(user, status=args.get("status"))
    
    if name == "get_schedule":
        return run_get_schedule(user, work_date=args.get("work_date"))

    return {"error": f"Unknown tool: {name}"}