class AnyType(str):
    def __eq__(self, other):
        return True

    def __ne__(self, other):
        return False


ANY = AnyType("*")


class SwitchBooleanNode:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "input_a": (ANY,),
                "input_b": (ANY,),
                "boolean_switch": ("BOOLEAN", {"default": True}),
            }
        }

    RETURN_TYPES = (ANY,)
    RETURN_NAMES = ("output",)
    FUNCTION = "switch"
    CATEGORY = "IXIWORKS/Utils"

    def switch(self, input_a, input_b, boolean_switch):
        return (input_a if boolean_switch else input_b,)


class StringToListNode:
    MAX_INPUTS = 8

    @classmethod
    def INPUT_TYPES(cls):
        required = {
            "count": ("INT", {"default": 4, "min": 1, "max": cls.MAX_INPUTS, "step": 1}),
            "prompt_1": ("STRING", {"default": "", "multiline": True}),
        }
        optional = {
            f"prompt_{i}": ("STRING", {"default": "", "multiline": True})
            for i in range(2, cls.MAX_INPUTS + 1)
        }
        return {"required": required, "optional": optional}

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("strings",)
    OUTPUT_IS_LIST = (True,)
    FUNCTION = "convert"
    CATEGORY = "IXIWORKS/Utils"

    def convert(self, count, **kwargs):
        result = []
        for i in range(1, count + 1):
            key = f"prompt_{i}"
            value = kwargs.get(key, "").strip()
            if value:
                result.append(value)
        if not result:
            result.append("")
        return (result,)


class JoinStringsNode:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "string_a": ("STRING", {"default": "", "multiline": True}),
                "string_b": ("STRING", {"default": "", "multiline": True}),
            },
            "optional": {
                "separator": ("STRING", {"default": " "}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("joined_string",)
    FUNCTION = "join"
    CATEGORY = "IXIWORKS/Utils"

    def join(self, string_a, string_b, separator=" "):
        return (f"{string_a}{separator}{string_b}",)


NODE_CLASS_MAPPINGS = {
    "SwitchBoolean": SwitchBooleanNode,
    "StringToList": StringToListNode,
    "JoinStrings": JoinStringsNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "SwitchBoolean": "Switch (Utils)",
    "StringToList": "String to List (Utils)",
    "JoinStrings": "Join Strings (Utils)",
}
